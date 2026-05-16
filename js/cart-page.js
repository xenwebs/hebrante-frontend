import { getCart } from "./cart.js"

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
            <p class="t2">$${item.price}</p>
        </div>
        <div class="line">
            <p class="t2">${item.size}</p>
            <p class="t2">Cantidad: ${item.quantity}</p>
        </div>
        <button class="cart-item__delete" data-id="${item.id}" data-size="${item.size}">
            Borrar
        </button>
      </div>
    </div>
  `).join("")

  container.addEventListener("click", (e) => {
  if (e.target.classList.contains("cart-item__delete")) {
    const btn = e.target
    const id = btn.dataset.id
    const size = btn.dataset.size

    removeFromCart(id, size)
    function removeFromCart(id, size) {
  let cart = getCart()

  console.log("КЛИК:", id, size)
  console.log("КОРЗИНА:", cart)

  cart = cart.filter(item => {
    console.log("СРАВНЕНИЕ:", item.id, item.size)
    return !(item.id === id && item.size === size)
  })

  localStorage.setItem("cart", JSON.stringify(cart))

  location.reload()
}
  }
})
  // 🔥 считаем total
  const total = cart.reduce((sum, item) => {
    return sum + (item.price * item.quantity)
  }, 0)

  // выводим
  if (totalEl) {
    totalEl.textContent = formatPrice(total)
  }

  function formatPrice(price) {
  return price.toLocaleString("es-CO")
    }

    function removeFromCart(id, size) {
  let cart = getCart()

  cart = cart.filter(item => {
    return !(item.id === id && item.size === size)
  })

  localStorage.setItem("cart", JSON.stringify(cart))

  location.reload() // 🔥 быстрое решение (перерисовать)
}

})