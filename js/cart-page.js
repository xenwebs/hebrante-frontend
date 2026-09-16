import {
  getCart,
  increaseQuantity,
  decreaseQuantity
} from "./cart.js"

document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector(".cart-items")
  const totalEl = document.querySelector(".cart-total")

  const cart = getCart()

  if (!container) return

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}">
      <div class="cart-item__info">
        <div class="line">
            <p class="t2">${item.title}</p>
            <p class="t2">$${formatPrice(item.price)}</p>
        </div>
        <div class="line">
            <p class="t2">talla: ${item.size}</p>
            <div class="cart-quantity">
              <button 
                class="qty-btn minus"
                data-id="${item.id}"
                data-size="${item.size}"
              >
                -
              </button>

              <span class="t2">${item.quantity}</span>

              <button
                class="qty-btn plus"
                data-id="${item.id}"
                data-size="${item.size}"
                >
                  +
              </button>
            </div>
        </div>
      </div>
    </div>
  `).join("")


  // КНОПКИ + И -

  container.addEventListener("click", (e) => {

    // МИНУС

    if (e.target.classList.contains("minus")) {

      const id = e.target.dataset.id

      const size = e.target.dataset.size

      decreaseQuantity(id, size)

      location.reload()

    }

    // ПЛЮС

    if (e.target.classList.contains("plus")) {

      const id = e.target.dataset.id

      const size = e.target.dataset.size

      increaseQuantity(id, size)

      location.reload()

    }

  })

  // TOTAL

  const total = cart.reduce((sum, item) => {

    return sum + (item.price * item.quantity)

  }, 0)

  if (totalEl) {

    totalEl.textContent = formatPrice(total)

  }

  function formatPrice(price) {

    return price.toLocaleString("es-CO")

  }

})