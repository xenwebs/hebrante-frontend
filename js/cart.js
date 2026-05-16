const CART_KEY = "cart"

// получить корзину
export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY)) || []
}

// сохранить корзину
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

// добавить товар
export function addToCart(product) {
  const cart = getCart()

  const existing = cart.find(
    item => item.id === product.id && item.size === product.size
  )

  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ ...product, quantity: 1 })
  }
  

  saveCart(cart)
  updateCartCount()
}

export function clearCart() {
  localStorage.removeItem("cart")
  console.log("✅ Корзина очищена")
}

export function getCartCount() {
  const cart = getCart()

  return cart.reduce((total, item) => {
    return total + item.quantity
  }, 0)
}

export function updateCartCount() {
  const countEl = document.querySelector(".cart-count")
  if (!countEl) return

  const count = getCartCount()
  
  if (count === 0) {
    countEl.style.display = "none"  // Скрываем если 0
  } else {
    countEl.style.display = "inline-block"  // Показываем если > 0
    countEl.textContent = count
  }
}

