// Компонент для отображения товара в корзине/чекауте
import { getCart } from "./cart.js"
console.log("Товары в корзине:", getCart())

export function renderCartItem(item) {
  return `
    <div class="order-item">
      <img src="${item.image}" alt="${item.title}" class="order-item__image" />
      <div class="order-item__details">
        <div class="line">
          <p class="order-item__title">${item.title}</p>
          <p class="order-item__price">
        $${new Intl.NumberFormat("es-CO").format(item.price * item.quantity)}
      </p>
        </div>
        <div class="line">
          <p class="order-item__size">Talla: ${item.size}</p>
          <p class="order-item__quantity">Cantidad: ${item.quantity}</p>
        </div>
      </div>
    </div>
  `
}

export function renderCartItems(items) {
  if (!items || items.length === 0) {
    return '<p style="color: #999; text-align: center;">Tu carrito está vacío</p>'
  }

  return items.map(item => renderCartItem(item)).join("")
}