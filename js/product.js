import { addToCart } from "./cart.js"
import { initMiniCart } from "./mini-cart.js"
import { initSizeHelper } from "./size-helper.js"
import { getLanguage, translatePage, initLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

let closeDropdownHandler = null;

function getPreloader() {
  return window.globalPreloader || {
    show: () => {
      const el = document.getElementById('global-preloader');
      if (el) el.classList.remove('hidden');
    },
    hide: (delay = 300) => {
      const el = document.getElementById('global-preloader');
      if (el) {
        setTimeout(() => el.classList.add('hidden'), delay);
      }
    }
  };
}

export async function loadProduct() {
  try {
    const preloader = getPreloader();
    
    // ✅ Показываем прелоадер в начале
    preloader.show();

    if (closeDropdownHandler) {
      document.removeEventListener("click", closeDropdownHandler);
      closeDropdownHandler = null;
    }

    const lang = getLanguage();
    
    const params = new URLSearchParams(window.location.search)
    const slug = params.get("slug")

    if (!slug) {
      console.error("Нет slug в URL")
      preloader.hide(300);
      return
    }

    const res = await fetch(
      `${API_URL}/api/products?filters[slug][$eq]=${slug}&populate=*`
    )

    const data = await res.json()

    if (!data.data || !data.data.length) {
      console.error("Товар не найден")
      preloader.hide(300);
      return
    }

    const item = data.data[0]

    const formattedPrice = new Intl.NumberFormat("es-CO").format(item.price)

    const product = {
      title: lang === 'en' ? (item.title_en || item.title) : item.title,
      price: item.price,
      formattedPrice: formattedPrice,
      slug: item.slug,
      description: lang === 'en' ? (item.description_en || item.description) : item.description,
      details: item.details,
      materials: item.materials,
      shipping: item.shipping,
      feature1: lang === 'en' ? (item.feature1_en || item.feature1) : item.feature1,
      feature2: lang === 'en' ? (item.feature2_en || item.feature2) : item.feature2,
      feature3: lang === 'en' ? (item.feature3_en || item.feature3) : item.feature3,
      images: item.images.map(img => img.url),
      sizes: item.sizesData,
      fitCoefficients: item.fitCoefficients,
      stock_by_size: item.stock_by_size
    }

    renderProduct(product)

    // ✅ Жди 300ms перед инициализацией UI
    await new Promise(resolve => setTimeout(resolve, 300));
    
    initProductUI(product)
    initSizeHelper(product)
    initMiniCart()

    // ✅ Дополнительная задержка перед скрытием прелоадера
    await new Promise(resolve => setTimeout(resolve, 300));

    setTimeout(() => {
      translatePage();
      updateSizeDropdownLabel();
      
      // ✅ Скрываем прелоадер с задержкой для плавного исчезновения
      preloader.hide(700);
    }, 100);

  } catch (error) {
    console.error("Ошибка загрузки товара:", error)
    const preloader = getPreloader();
    preloader.hide(300);
  }

  await loadRecommendedProducts()
}

function updateSizeDropdownLabel() {
  const sizeSelected = document.querySelector('.size-dropdown__selected')
  if (!sizeSelected) return
  
  const lang = getLanguage()
  
  if (['XS', 'S', 'M', 'L', 'XL'].includes(sizeSelected.textContent.trim())) {
    return
  }
  
  sizeSelected.textContent = lang === 'en' ? 'Size' : 'Talla'
}

function renderProduct(product) {
  const container = document.querySelector(".product-layout")
  if (!container) return

  const sizes = ['XS', 'S', 'M', 'L', 'XL']
  const sizeButtonsHTML = sizes.map(size => {
    const stock = Number(product.stock_by_size?.[size.toLowerCase()] || 0)
    const isDisabled = stock <= 0
    const disabledClass = isDisabled ? 'size-dropdown__option--disabled' : ''
    const disabledAttr = isDisabled ? 'disabled' : ''
    
    return `<button class="size-dropdown__option ${disabledClass}" ${disabledAttr}>${size}</button>`
  }).join('')

  container.innerHTML = `
    <div class="product-layout__image">
      <img src="${product.images[0] || ""}">
    </div>

    <div class="product-layout__info">
      <h1 class="product__title">${product.title}</h1>
      <p class="product__price">$${product.formattedPrice}</p>

      <div class="product-sizes">
        <div class="size-dropdown">
          <button class="size-dropdown__btn">
            <span class="size-dropdown__selected" data-i18n="size">Talla</span>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="#1E110D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div class="size-dropdown__list">
            ${sizeButtonsHTML}
          </div>
          </div>
        <button class="size-recommend" data-i18n="what_size">
          ¿Cuál es mi talla?
        </button>
      </div>

      <button class="product__add-to-cart" data-i18n="add_to_cart">
        Añadir al carrito
      </button>

      <div class="accordion">
        <button class="accordion__header">
          <span data-i18n="description">Descripción</span>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="#1E110D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="accordion__content">
          ${product.description || ""}
        </div>
      </div>
      <div class="accordion">
        <button class="accordion__header">
          <span data-i18n="materials">Materiales</span>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="#1E110D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="accordion__content">
          ${product.materials || ""}
        </div>
      </div>
      <div class="accordion">
        <button class="accordion__header">
          <span data-i18n="shipping">Envío</span>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9L12 15L18 9" stroke="#1E110D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="accordion__content">
          <span>Envíos gratis en toda Colombia. El tiempo de entrega estimado es de 3 a 5 días hábiles, más un procesamiento previo de 24 a 48 horas, los tiempos pueden variar en temporadas altas.</span>
        </div>
      </div>
    </div>
    <div class="product-layout__features">
      <p class="t2">${product.feature1 || ""}</p>
      <p class="t2">${product.feature2 || ""}</p>
      <p class="t2">${product.feature3 || ""}</p>
    </div>

    <div class="product-layout__image">
      <img src="${product.images[1] || ""}">
    </div>

    <div class="product-layout__image">
      <img src="${product.images[2] || ""}">
    </div>

    <div class="product-layout__image">
      <img src="${product.images[3] || ""}">
    </div>

    <div class="product-layout__image">
      <img src="${product.images[4] || ""}">
    </div>
  `
  
  document.querySelectorAll(".accordion").forEach(item => {
    const btn = item.querySelector(".accordion__header")
    
    btn.onclick = null;

    btn.addEventListener("click", () => {
      item.classList.toggle("active")
    })
  })
}

function initProductUI(product) {
  const dropdown = document.querySelector(".size-dropdown")
  
  if (!dropdown) {
    console.error("dropdown не найден")
    return
  }
  
  const btn = dropdown.querySelector(".size-dropdown__btn")
  const options = dropdown.querySelectorAll(".size-dropdown__option")
  const selected = dropdown.querySelector(".size-dropdown__selected")

  let selectedSize = null

  btn.onclick = null;
  
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open")
  })

  options.forEach(option => {
    option.onclick = null;
    
    if (option.disabled) {
      return
    }
    
    option.addEventListener("click", () => {
      selected.textContent = option.textContent
      selectedSize = option.textContent
      dropdown.classList.remove("open")
    })
  })

  if (closeDropdownHandler) {
    document.removeEventListener("click", closeDropdownHandler);
  }
  
  closeDropdownHandler = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open")
    }
  }
  
  document.addEventListener("click", closeDropdownHandler)

  const addToCartBtn = document.querySelector(".product__add-to-cart")
  
  if (addToCartBtn) {
    addToCartBtn.onclick = null;
    
    addToCartBtn.addEventListener("click", () => {
  const size = window.selectedProductSize || selectedSize
  
  console.log("selectedSize:", size)
  
  if (!size) {
    alert("Por favor selecciona una talla")
    return
  }

  const stock = Number(product.stock_by_size?.[size.toLowerCase()])

  if (stock <= 0) {
    alert("Esta talla no está disponible")
    return
  }

  addToCart({
    id: product.slug,
    title: product.title,
    price: product.price,
    image: product.images[0],
    size: size,
    stock_by_size: product.stock_by_size
  })
  })
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initLanguage()
  
  const headerContainer = document.getElementById("header")
  if (headerContainer && !headerContainer.innerHTML.trim()) {
    const res = await fetch("/components/header.html")
    const html = await res.text()
    headerContainer.innerHTML = html
    
    const { initHeader } = await import("./header.js")
    initHeader()
  }
  
  const footerContainer = document.getElementById("footer")
  if (footerContainer && !footerContainer.innerHTML.trim()) {
    const res = await fetch("/components/footer.html")
    const html = await res.text()
    footerContainer.innerHTML = html
    
    const { initFooter } = await import("./footer.js")
    initFooter()
  }
  
  await loadProduct()
})

// ✅ Загрузи рекомендуемые товары в конце страницы
async function loadRecommendedProducts() {
  try {
    const lang = getLanguage();
    const res = await fetch(`${API_URL}/api/products?populate=*&pagination[limit]=3`)
    const data = await res.json()

    const products = data.data.slice(0, 3).map(item => ({
      title: lang === 'en' ? (item.title_en || item.title) : item.title,
      price: item.price,
      formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
      slug: item.slug,
      image: item.images?.[0]?.url
        ? item.images[0].url
        : "",
      collectionSlug: item.collection?.slug,
      collectionTitle: item.collection?.title
    }))

    const grid = document.querySelector(".products-grid")
    if (grid) {
      const { productCard } = await import("../components/product-card.js")
      grid.innerHTML = products.map(productCard).join("")
      
      // ✅ ВАЖНО: Скрываем прелоадер БЕЗ задержки когда карточки загружены
      if (window.hidePreloaderImmediately) {
        window.hidePreloaderImmediately();
      }
    }

  } catch (error) {
    console.error("Ошибка загрузки рекомендуемых товаров:", error)
  }
}