import { showMiniCart } from "./mini-cart.js"

const CART_KEY = "cart"

// получить корзину
export function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY)) || []
}

// сохранить корзину
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

// ✅ УПРОЩЁННАЯ ФУНКЦИЯ: проверка стока перед добавлением
async function checkStock(product) {
  try {
    // Используем stock_by_size который уже приходит с товаром
    const stock = product.stock_by_size || {}
    
    // ✅ СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ONESIZE ТОВАРОВ
    let availableStock = 0
    if (product.size === "onesize") {
      // Для onesize товаров берем сток из xxs
      availableStock = stock['xxs'] || 0
    } else {
      // Для обычных товаров берем по размеру
      availableStock = stock[product.size.toLowerCase()] || 0
    }

    if (availableStock <= 0) {
      return {
        isValid: false,
        message: `❌ ${product.title} (${product.size}) - agotado (no hay en stock)`
      }
    }

    return {
      isValid: true,
      availableStock
    }
  } catch (error) {
    console.error("Stock check error:", error)
    return {
      isValid: false,
      message: "Error al verificar el stock. Intenta de nuevo."
    }
  }
}

// добавить товар
export async function addToCart(product) {
  try {
    // ✅ ПЕРВОЕ: проверь сток ДО добавления
    const stockCheck = await checkStock(product)
    
    if (!stockCheck.isValid) {
      throw new Error(stockCheck.message)
    }

    const cart = getCart()

    const existing = cart.find(
      item => item.id === product.id && item.size === product.size
    )

    if (existing) {
      // Проверь что не превышаем доступный сток
      if (existing.quantity >= stockCheck.availableStock) {
        throw new Error(
          `❌ Solo hay ${stockCheck.availableStock} ${product.title} (${product.size}) disponibles`
        )
      }
      existing.quantity += 1
    } else {
      cart.push({ ...product, quantity: 1 })
    }

    saveCart(cart)
    updateCartCount()
    
    // ✅ ПОКАЗЫВАЕМ МИНИКАРЗИНУ ВМЕСТО ALERT
    showMiniCart()
    
    return {
      success: true,
      message: `✅ ${product.title} agregado al carrito`
    }

  } catch (error) {
    console.error("Add to cart error:", error)
    alert(error.message || "Error al agregar el producto al carrito")
    return {
      success: false,
      message: error.message || "Error al agregar el producto al carrito"
    }
  }
}

export function clearCart() {
  localStorage.removeItem("cart")
  console.log("✅ Carrito vaciado")
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

// увеличить количество
export async function increaseQuantity(id, size) {
  const cart = getCart()

  const item = cart.find(
    item => item.id === id && item.size === size
  )

  if (!item) return { success: false, message: "Producto no encontrado" }

  // ✅ Проверь сток перед увеличением
  const stock = item.stock_by_size || {}
  
  // ✅ СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ONESIZE
  let availableStock = 0
  if (item.size === "onesize") {
    availableStock = stock['xxs'] || 0
  } else {
    availableStock = stock[item.size.toLowerCase()] || 0
  }

  if (item.quantity >= availableStock) {
    return {
      success: false,
      message: `Solo hay ${availableStock} disponibles de ${item.title}`
    }
  }

  item.quantity += 1
  saveCart(cart)
  updateCartCount()

  return { success: true }
}

// уменьшить количество
export function decreaseQuantity(id, size) {
  let cart = getCart()

  const item = cart.find(
    item => item.id === id && item.size === size
  )

  if (!item) return

  item.quantity -= 1

  // если стало 0 — удалить товар
  if (item.quantity <= 0) {
    cart = cart.filter(
      product => !(product.id === id && product.size === size)
    )
  }

  saveCart(cart)
  updateCartCount()
}

// ✅ Удалить товар из корзины
export function removeFromCart(id, size) {
  let cart = getCart()
  cart = cart.filter(
    product => !(product.id === id && product.size === size)
  )
  saveCart(cart)
  updateCartCount()
}