import { getCart, clearCart } from "./cart.js"
import { renderCartItems } from "./cart-item.js"
import { initHeader } from "./header.js"  // ← ДОБАВЬ!
import { initFooter } from "./footer.js"  // ← ДОБАВЬ!
import { initLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// 🔑 BOLD API CONFIGURATION - ПРАВИЛЬНО
const BOLD_CONFIG = {
  PUBLIC_KEY: "FjqKPK8KF8uY_6Ca13ZCaNEm928t9Lyz0SC33LRCiHY",
  MODE: "production"
}

console.log(`🔧 Bold configured for: ${BOLD_CONFIG.MODE}`)
console.log(`🔐 Using Public Key: ${BOLD_CONFIG.PUBLIC_KEY.substring(0, 20)}...`)


// Colombian cities and states mapping
const colombianCities = {
  "Bogotá": "Cundinamarca",
  "Medellín": "Antioquia",
  "Cali": "Valle del Cauca",
  "Barranquilla": "Atlántico",
  "Cartagena": "Bolívar",
  "Santa Marta": "Magdalena",
  "Bucaramanga": "Santander",
  "Cúcuta": "Norte de Santander",
  "Pasto": "Nariño",
  "Manizales": "Caldas"
}

const shippingCosts = {
  standard: 0,
  express: 15000
}

// ==================== INITIALIZATION ====================

document.addEventListener("DOMContentLoaded", async () => {
  // Load header & footer
  const headerContainer = document.getElementById("header")
  if (headerContainer && !headerContainer.innerHTML.trim()) {
    await loadComponent("header", "/components/header.html", initHeader)
  } else if (headerContainer) {
    initHeader()
  }

  const footerContainer = document.getElementById("footer")
  if (footerContainer && !footerContainer.innerHTML.trim()) {
    await loadComponent("footer", "/components/footer.html", () => {
      console.log("✅ Footer загружен")
    })
  }

  // Initialize checkout
  await initCheckout()
})

async function initBold() {
  return new Promise((resolve, reject) => {
    // Проверь есть ли скрипт уже загружен
    if (document.querySelector('script[src="https://checkout.bold.co/library/boldPaymentButton.js"]')) {
      console.log("✅ Bold скрипт уже загружен")
      resolve()
      return
    }

    // Загрузи скрипт динамически
    const js = document.createElement('script')
    js.onload = () => {
      console.log("✅ Bold скрипт загружен успешно")
      resolve()
    }
    js.onerror = () => {
      console.error("❌ Ошибка загрузки Bold скрипта")
      reject(new Error("Bold script failed to load"))
    }
    js.src = 'https://checkout.bold.co/library/boldPaymentButton.js'
    document.head.appendChild(js)
  })
}

async function loadComponent(id, path, callback) {
  try {
    const res = await fetch(path)
    const html = await res.text()
    const container = document.getElementById(id)
    if (!container) return
    container.innerHTML = html
    if (callback) callback()
  } catch (error) {
    console.error(`Error loading component: ${path}`, error)
  }
}

async function initCheckout() {
  try {
    // Get cart data
    const cart = getCart()
    console.log("🛒 Carrito:", cart)
    
    if (!cart || cart.length === 0) {
      console.warn("Carrito vacío, redirigiendo...")
      window.location.href = "/cart.html"
      return
    }

    // Render cart items using cart-item.js
    const orderItemsContainer = document.getElementById("order-items")
    if (orderItemsContainer) {
      orderItemsContainer.innerHTML = renderCartItems(cart)
    }

    // Calculate totals
    updateTotals(cart)

    // Setup form listeners
    setupFormListeners(cart)

    // Setup form submission
    document.getElementById("checkout-form").addEventListener("submit", (e) => handleSubmit(e, cart))

  } catch (error) {
    console.error("Checkout init error:", error)
    showError("Ошибка при загрузке страницы оплаты")
  }
}

// ==================== RENDER FUNCTIONS ====================

function updateTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  // Получить shipping метод
  const shippingInput = document.querySelector('input[name="shipping"]')
  const shippingMethod = shippingInput ? shippingInput.value : "standard"
  const shippingCost = shippingCosts[shippingMethod] || 0
  const total = subtotal + shippingCost

  const formatter = new Intl.NumberFormat("es-CO")

  // ✅ ПРОВЕРЯЙ НАЛИЧИЕ элемента перед использованием!
  const subtotalEl = document.getElementById("subtotal")
  const shippingCostEl = document.getElementById("shipping-cost")
  const totalEl = document.getElementById("total")
  const submitBtn = document.getElementById("submit-btn")

  if (subtotalEl) {
    subtotalEl.textContent = `$${formatter.format(subtotal)}`
  }
  
  if (shippingCostEl) {
    shippingCostEl.textContent = shippingCost === 0 ? "Gratis" : `$${formatter.format(shippingCost)}`
  }
  
  if (totalEl) {
    totalEl.textContent = `$${formatter.format(total)}`
  }
  
  if (submitBtn) {
    submitBtn.textContent = `Confirmar Pedido`
  }

  console.log(`✅ Totales: Subtotal=$${formatter.format(subtotal)}, Envío=$${formatter.format(shippingCost)}, Total=$${formatter.format(total)}`)
}

// ==================== FORM HANDLING ====================

function setupFormListeners(cart) {
  // Update totals when shipping method changes
  document.querySelectorAll('input[name="shipping"]').forEach(input => {
    input.addEventListener("change", () => {
      updateTotals(cart)
    })
  })

  // Auto-fill state when city changes
  const cityInput = document.getElementById("city")
  if (cityInput) {
    cityInput.addEventListener("change", (e) => {
      const city = e.target.value
      if (colombianCities[city]) {
        const stateInput = document.getElementById("state")
        if (stateInput) stateInput.value = colombianCities[city]
      }
    })
  }

  // Clear error messages on input
  document.querySelectorAll(".form-input, select").forEach(input => {
    input.addEventListener("focus", () => {
      const errorEl = document.getElementById(`${input.id}-error`)
      if (errorEl) {
        errorEl.textContent = ""
        errorEl.classList.remove("error-active")  // ← УДАЛИ класс при фокусе
      }
      input.classList.remove("has-error")  // ← УДАЛИ класс с input
    })
  })
}

function validateForm() {
  const errors = {}

  // Сначала ОЧИСТИ все ошибки
  document.querySelectorAll(".form-error").forEach(el => {
    el.textContent = ""
    el.classList.remove("error-active")
  })
  
  document.querySelectorAll(".form-input, select").forEach(el => {
    el.classList.remove("has-error")
  })

  // Email
  const email = document.getElementById("email").value
  if (!email || !email.includes("@")) {
    errors.email = "Email válido es requerido"
  }

  // Phone
  const phone = document.getElementById("phone").value
  if (!phone || phone.length < 10) {
    errors.phone = "Teléfono válido es requerido"
  }

  // Name
  const firstName = document.getElementById("firstName").value
  if (!firstName) {
    errors.firstName = "Nombre es requerido"
  }

  const lastName = document.getElementById("lastName").value
  if (!lastName) {
    errors.lastName = "Apellido es requerido"
  }

  // Address
  const street = document.getElementById("street").value
  if (!street) {
    errors.street = "Dirección es requerida"
  }

  // City & State
  const city = document.getElementById("city").value
  const state = document.getElementById("state").value

  if (!city) {
    errors.city = "Ciudad es requerida"
  }

  if (!state) {
    errors.state = "Departamento es requerido"
  }

  // Validate city-state relationship
  if (city && colombianCities[city] && colombianCities[city] !== state) {
    errors.city = `${city} está en ${colombianCities[city]}`
  }

  // ZIP
  const zip = document.getElementById("zip").value
  if (!zip || zip.length < 5) {
    errors.zip = "Código postal válido es requerido"
  }

  // ПОТОМ добавь ошибки
  Object.keys(errors).forEach(field => {
    const errorEl = document.getElementById(`${field}-error`)
    const inputEl = document.getElementById(field)
    
    if (errorEl) {
      errorEl.textContent = errors[field]
      errorEl.classList.add("error-active")  // ← ДОБАВЬ класс
      console.log(`✅ Добавлен класс error-active для ${field}`)  // для проверки
    }
    
    if (inputEl) {
      inputEl.classList.add("has-error")  // ← ДОБАВЬ класс
    }
  })

  return Object.keys(errors).length === 0
}

// ==================== STOCK VALIDATION ====================

async function validateStock(cart) {
  try {
    for (const item of cart) {
      // ✅ Используй stock_by_size ИЗ КОРЗИНЫ, не из Strapi!
      const stock = item.stock_by_size || {}
      const availableStock = stock[item.size.toLowerCase()] || 0

      // Проверяй наличие
      if (availableStock < item.quantity) {
        showError(`❌ ${item.title} (${item.size}) - в наличии только ${availableStock} шт., а ты хочешь ${item.quantity}`)
        return false
      }

      console.log(`✅ ${item.title} (${item.size}): ${availableStock} в наличии`)
    }

    return true

  } catch (error) {
    console.error("Stock validation error:", error)
    showError("Ошибка при проверке наличия товара")
    return false
  }
}

async function handleSubmit(e, cart) {
  e.preventDefault()

  // Validate stock
  const stockValid = await validateStock(cart)
  if (!stockValid) {
    return
  }

  // Validate form
  if (!validateForm()) {
    showError("Por favor completa todos los campos correctamente")
    return
  }

  const submitBtn = document.getElementById("submit-btn")
  if (!submitBtn) return
  
  submitBtn.disabled = true
  const originalText = submitBtn.textContent
  submitBtn.textContent = "Creando pedido..."

  try {
    // 1️⃣ Создай заказ в Strapi
    console.log("🔄 Начинаю создавать заказ...")
    const order = await createOrder(cart)
    console.log("✅ Заказ создан! ID:", order.data.id)

    if (order && order.data && order.data.id) {
    const shippingMethod = document.querySelector('input[name="shipping"]').value || "standard"
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingCosts[shippingMethod] || 0
    const total = subtotal + shippingCost

    // Вызови функцию на сервере вместо локальной
    console.log("🔄 Запрашиваю хеш с сервера...")
    const hashRes = await fetch('/.netlify/functions/generate-hash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.data.id,
        amount: total,
        currency: 'COP'
      })
    })

    const hashData = await hashRes.json()
    const hash = hashData.integritySignature

    console.log("✅ Хеш получен:", hash)

    // Создай Bold кнопку
    const boldScript = document.createElement("script")
    boldScript.setAttribute("data-bold-button", "dark-M")
    boldScript.setAttribute("data-api-key", BOLD_CONFIG.PUBLIC_KEY)
    boldScript.setAttribute("data-order-id", `ORD-${order.data.id}`)
    boldScript.setAttribute("data-amount", total.toString())
    boldScript.setAttribute("data-currency", "COP")
    boldScript.setAttribute("data-integrity-signature", hash)
    boldScript.setAttribute("data-redirection-url", window.location.origin + `/pages/order-confirmation.html?order_id=${order.data.id}`)
    boldScript.setAttribute("data-description", `Pedido #${order.data.id}`)
    
    document.body.appendChild(boldScript)

    // clearCart()
    showSuccess("✅ Abre el modal de pago de Bold")
  }

  } catch (error) {
    console.error("Order creation error:", error)
    showError("Error al crear el pedido. Por favor intenta de nuevo.")
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// ==================== BOLD PAYMENT PROCESSING ====================

async function processPaymentWithBold(cart, formData, orderId) {
  const shippingMethod = document.querySelector('input[name="shipping"]').value || "standard"
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shippingCost = shippingCosts[shippingMethod] || 0
  const total = subtotal + shippingCost

  try {
    console.log("🔄 Вызываю generate-signature...")
    console.log("URL:", `${API_URL}/api/orders/generate-signature`)
    console.log("Данные:", { orderId, amount: total, currency: "COP" })

    // 1️⃣ Получи хеш с backend
    const signRes = await fetch(`${API_URL}/api/orders/generate-bold-signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: `ORD-${order.id}`,
        amount: total,
        currency: "COP"
      })
    })

    console.log("📡 Response status:", signRes.status)
    
    // ✅ ОДИН раз вызови .json()!
    const signData = await signRes.json()
    console.log("✅ Данные с backend:", signData)

    // Если endpoint возвращает buttonConfig
    const buttonConfig = signData.buttonConfig || {
      apiKey: BOLD_CONFIG.PUBLIC_KEY,
      orderId: `ORD-${orderId}`,
      amount: total.toString(),
      currency: "COP",
      integritySignature: signData.integritySignature,
      redirectionUrl: window.location.origin + `/pages/order-confirmation.html?order_id=${orderId}`,
      description: `Pedido #${orderId}`
    }

    console.log("✅ Button config:", buttonConfig)

    // 2️⃣ Динамически создай кнопку с правильными атрибутами
    const boldScript = document.createElement("script")

    boldScript.src = "https://checkout.bold.co/library/boldPaymentButton.js"

    boldScript.setAttribute("data-bold-button", "dark-M")
    boldScript.setAttribute("data-api-key", buttonConfig.apiKey)
    boldScript.setAttribute("data-order-id", `ORD-${orderId}`)
    boldScript.setAttribute("data-amount", buttonConfig.amount)
    boldScript.setAttribute("data-currency", buttonConfig.currency)
    boldScript.setAttribute("data-integrity-signature", buttonConfig.integritySignature)
    boldScript.setAttribute("data-redirection-url", buttonConfig.redirectionUrl)
    boldScript.setAttribute("data-description", buttonConfig.description)

    document.body.appendChild(boldScript)

    boldScript.onload = () => {
      console.log("✅ Bold script loaded")
    }

    clearCart()
    showSuccess("Abre el modal de pago de Bold")
    
      console.log("✅ Bold button добавлена")

  } catch (error) {
    console.error("❌ processPaymentWithBold error:", error)
    throw error
  }
}

// ==================== API FUNCTIONS ====================

function collectFormData() {
  return {
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    firstName: document.getElementById("firstName").value,
    lastName: document.getElementById("lastName").value,
    street: document.getElementById("street").value,
    apartment: document.getElementById("apartment").value || "",
    city: document.getElementById("city").value,
    state: document.getElementById("state").value,
    zip: document.getElementById("zip").value
  }
}

async function createOrder(cart) {
  try {
    const shippingMethod = document.querySelector('input[name="shipping"]').value || "standart"
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingCosts[shippingMethod] || 0
    const total = subtotal + shippingCost

    const orderData = {
      data: {
        // Contact info
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,

        // Shipping info
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        street: document.getElementById("street").value,
        apartment: document.getElementById("apartment").value || "",
        city: document.getElementById("city").value,
        state: document.getElementById("state").value,
        zip: document.getElementById("zip").value,

        // Shipping info
        shippingMethod,
        
        // Status (pending payment)
        orderStatus: "pending",

        // Items
        items: cart,
        
        // Totals
        subtotal,
        shippingCost,
        total,
        }
    }

    console.log("📤 Enviando pedido a Strapi:", orderData)

    const response = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "Order creation failed")
    }

    const result = await response.json()
    console.log("✅ Pedido creado:", result)

    return result

  } catch (error) {
    console.error("Create order error:", error)
    throw error
  }
}

// ==================== UTILITIES ====================

function showError(message) {
  const errorEl = document.getElementById("payment-message")
  if (!errorEl) return
  
  errorEl.textContent = message
  errorEl.style.color = "#d32f2f"
  errorEl.style.backgroundColor = "rgba(211, 47, 47, 0.1)"
  errorEl.style.display = "block"
  errorEl.style.padding = "10px"
  errorEl.style.borderRadius = "4px"
  errorEl.style.marginBottom = "15px"
}

function showSuccess(message) {
  const errorEl = document.getElementById("payment-message")
  if (!errorEl) return
  
  errorEl.textContent = message
  errorEl.style.color = "#388e3c"
  errorEl.style.backgroundColor = "rgba(56, 142, 60, 0.1)"
  errorEl.style.display = "block"
  errorEl.style.padding = "10px"
  errorEl.style.borderRadius = "4px"
  errorEl.style.marginBottom = "15px"
}
