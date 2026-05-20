import { getCart, removeFromCart, increaseQuantity, decreaseQuantity } from "./cart.js"
import { getLanguage } from "./lang.js"

export function initMiniCart() {
  // Создаём HTML миникарзины если его нет
  if (!document.getElementById("mini-cart")) {
    const miniCartHTML = `
      <div id="mini-cart" class="mini-cart hidden">
        <div class="mini-cart__overlay"></div>
        <div class="mini-cart__content">
          <div class="mini-cart__header">
            <p class="mini-cart__title">Artículo agregado a tu carrito</p>
            <button class="mini-cart__close">&times;</button>
          </div>

          <div class="mini-cart__items">
            <!-- Items будут добавлены динамически -->
          </div>

          <div class="mini-cart__footer">
            <button class="btn-lg mini-cart__btn mini-cart__btn--view" data-i18n="view_cart">Ver mi carrito</button>
            <button class="mini-cart__btn mini-cart__btn--continue" data-i18n="continue_shopping">Seguir comprando</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML("beforeend", miniCartHTML)
  }

  const miniCart = document.getElementById("mini-cart")
  const closeBtn = miniCart.querySelector(".mini-cart__close")
  const overlay = miniCart.querySelector(".mini-cart__overlay")
  const viewCartBtn = miniCart.querySelector(".mini-cart__btn--view")
  const continueBtn = miniCart.querySelector(".mini-cart__btn--continue")

  // Закрыть при клике на крестик
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    hideMiniCart()
  })

  // Закрыть при клике на оверлей
  overlay.addEventListener("click", (e) => {
    e.stopPropagation()
    hideMiniCart()
  })

  // Предотвратить закрытие при клике внутри контента
  miniCart.querySelector(".mini-cart__content").addEventListener("click", (e) => {
    e.stopPropagation()
  })

  // Перейти в корзину
  viewCartBtn.addEventListener("click", () => {
    window.location.href = "/cart"
  })

  // Закрыть и продолжить покупки
  continueBtn.addEventListener("click", () => {
    hideMiniCart()
  })
}

// ✅ Показать миникарзину
export function showMiniCart() {
  const miniCart = document.getElementById("mini-cart")
  if (!miniCart) {
    console.error("mini-cart не найден")
    return
  }

  // Обновляем содержимое корзины
  updateMiniCartContent()

  // Показываем с анимацией
  miniCart.classList.remove("hidden")
  
  // Небольшая задержка для плавной анимации
  setTimeout(() => {
    miniCart.classList.add("show")
  }, 10)
}

// ✅ Скрыть миникарзину
export function hideMiniCart() {
  const miniCart = document.getElementById("mini-cart")
  if (!miniCart) return

  miniCart.classList.remove("show")
  setTimeout(() => {
    miniCart.classList.add("hidden")
  }, 300) // Даём время на анимацию уход
}

// ✅ Обновить содержимое миникарзины
function updateMiniCartContent() {
  const miniCart = document.getElementById("mini-cart")
  const itemsContainer = miniCart.querySelector(".mini-cart__items")
  const cart = getCart()

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <p class="mini-cart__empty">Tu carrito está vacío</p>
    `
    return
  }

  // Формируем HTML для каждого товара
  const itemsHTML = cart.map(item => `
    <div class="mini-cart__item">
      <img src="${item.image}" alt="${item.title}" class="mini-cart__item-image">
      
      <div class="mini-cart__item-info">
        <h4 class="mini-cart__item-title">${item.title}</h4>
        <p class="mini-cart__item-size">Talla: ${item.size}</p>
        <p class="mini-cart__item-price">$${new Intl.NumberFormat("es-CO").format(item.price)}</p>
        
        <div class="mini-cart__item-controls">
          <button class="mini-cart__item-btn mini-cart__item-btn--decrease" data-id="${item.id}" data-size="${item.size}">−</button>
          <span class="mini-cart__item-qty">${item.quantity}</span>
          <button class="mini-cart__item-btn mini-cart__item-btn--increase" data-id="${item.id}" data-size="${item.size}">+</button>
        </div>
      </div>
    </div>
  `).join("")
  itemsContainer.innerHTML = itemsHTML

  // Добавляем обработчики для кнопок +/-
  itemsContainer.querySelectorAll(".mini-cart__item-btn--increase").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation()
      const id = e.target.dataset.id
      const size = e.target.dataset.size
      await increaseQuantity(id, size)
      updateMiniCartContent()
    })
  })

  itemsContainer.querySelectorAll(".mini-cart__item-btn--decrease").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const id = e.target.dataset.id
      const size = e.target.dataset.size
      decreaseQuantity(id, size)
      updateMiniCartContent()
    })
  })
}