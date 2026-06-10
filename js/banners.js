import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"  // ← ДОБАВЬ этот импорт

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"


export async function renderBanners() {
  try {
    const res = await fetch(`${API_URL}/api/banners?populate=*&sort=order:asc`)
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`)
    }
    
    const data = await res.json()

    if (!data.data || data.data.length === 0) {
      console.warn("⚠️ Нет баннеров в Strapi")
      return
    }

    console.log("✅ Баннеры загружены:", data.data)

    // Обнови каждый баннер и загрузи его продукты
    for (const bannerData of data.data) {
      const banner = document.querySelector(`[data-banner="${bannerData.slug}"]`)
      if (!banner) {
        console.warn(`⚠️ Баннер ${bannerData.slug} не найден в HTML`)
        continue
      }

      // Рендери баннер
      updateBanner(banner, bannerData)

      // Если есть привязанная коллекция - загрузи её продукты
      if (bannerData.collection?.slug) {
        // Найди products-grid который идет ПОСЛЕ этого баннера
        const productsGrid = banner.nextElementSibling?.querySelector(".products-grid") || 
                            banner.parentElement?.nextElementSibling?.querySelector(".products-grid")
        
        if (productsGrid) {
          await renderBannerProducts(bannerData.collection.slug, productsGrid)
        } else {
          console.warn(`⚠️ Grid не найден после баннера ${bannerData.slug}`)
        }
      }
    }

  } catch (error) {
    console.error("❌ Ошибка загрузки баннеров:", error)
  }
}

function updateBanner(bannerEl, bannerData) {
  const img = bannerEl.querySelector(".banner__image")
  
  console.log("🔍 updateBanner:", {
    slug: bannerData.slug,
    hasImg: !!img,
    imageUrl: bannerData.image?.url,
    imageObject: bannerData.image
  })
  
  if (img && bannerData.image?.url) {
    img.src = bannerData.image.url
    img.style.display = "block" // ← Добавь это
    console.log(`📸 Баннер ${bannerData.slug} изображение установлено: ${bannerData.image.url}`)
  } else {
    console.warn(`⚠️ Баннер ${bannerData.slug} - нет изображения!`)
  }


  // ✅ ДОБАВЬ ТЕКСТ (если нужен)
  const content = bannerEl.querySelector(".banner__content") || 
                  bannerEl.querySelector(".banner--home__content")
  if (content && bannerData.title) {
    content.innerHTML = `
      <div class="line">
        <p class="banner__text">${bannerData.title}</p>
        <p class="banner__text">Comprar</p>
      </div>
    `
    console.log(`📝 Текст баннера ${bannerData.slug} обновлен`)
  }


  // Если есть коллекция - добавь клик для перехода
  if (bannerData.collection?.slug) {
    bannerEl.style.cursor = "pointer"
    bannerEl.onclick = () => {
      window.location.href = `/pages/collection.html?slug=${bannerData.collection.slug}`
    }
    console.log(`🔗 Баннер ${bannerData.slug} привязан к коллекции ${bannerData.collection.slug}`)
  }

  console.log("✅ Баннер обновлен:", bannerData.slug)
}

async function renderBannerProducts(collectionSlug, productsGrid) {
  try {
    const lang = getLanguage();
    // Загрузи продукты коллекции
    const productsRes = await fetch(
      `${API_URL}/api/products?filters[collection][slug][$eq]=${collectionSlug}&populate=*`
    )
    const productsData = await productsRes.json()

    console.log(`📦 Продукты для ${collectionSlug}:`, productsData.data)

    if (productsData.data && productsData.data.length > 0) {
      // Преобразуй данные
      const products = productsData.data.slice(0, 3).map(item => ({
        title: lang === 'en' ? (item.title_en || item.title) : item.title,  // ← ДОБАВЬ ПЕРЕВОД!
        price: item.price,
        formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
        slug: item.slug,
        image: item.images?.[0]?.url
          ? item.images[0].url
          : "",
        collectionSlug: item.collection?.slug,
        collectionTitle: item.collection?.title
      }))
      
      productsGrid.innerHTML = products.map(productCard).join("")
      console.log(`✅ Продукты для ${collectionSlug} рендерены!`)
    } else {
      console.warn(`⚠️ Нет продуктов для ${collectionSlug}`)
    }

  } catch (error) {
    console.error(`❌ Ошибка загрузки продуктов для ${collectionSlug}:`, error)
  }
}