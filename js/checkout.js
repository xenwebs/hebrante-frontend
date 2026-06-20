import { getCart, clearCart } from "./cart.js"
import { renderCartItems } from "./cart-item.js"
import { initHeader } from "./header.js"  // ← ДОБАВЬ!
import { initFooter } from "./footer.js"  // ← ДОБАВЬ!
import { initLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// 🔑 WOMPI CONFIGURATION
// ⚠️ PUBLIC_KEY = llave PÚBLICA de Wompi.
//    La encuentras en el panel: Desarrolladores > "Llaves" (NO en "Secretos para integración técnica").
//    Sandbox:    pub_test_...
//    Producción: pub_prod_...
const WOMPI_CONFIG = {
  PUBLIC_KEY: "pub_test_6TYIQLf90x0XOUNvbCntvArwzGRh5HmI", // ← reemplázala por tu pub_test_...
  MODE: "test" // "test" (sandbox) | "production"
}

// URL oficial del Web Checkout de Wompi (redirección)
const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/"

console.log(`🔧 Wompi configurado en modo: ${WOMPI_CONFIG.MODE}`)
console.log(`🔐 Llave pública: ${WOMPI_CONFIG.PUBLIC_KEY.substring(0, 14)}...`)


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
  "Manizales": "Caldas",
  "Tunja": "Boyacá",
  "Duitama": "Boyacá",
  "Sogamoso": "Boyacá",
  "Paipa": "Boyacá"
}

const shippingCosts = {
  standard: 0,
  express: 15000
}

// ==================== PROMO CODE STATE ====================
let appliedPromoCode = null
let discountPercent = 0

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
      console.log("✅ Footer cargado")
    })
  }

  // Initialize checkout
  await initCheckout()
})

async function loadComponent(id, path, callback) {
  try {
    const res = await fetch(path)
    const html = await res.text()
    const container = document.getElementById(id)
    if (!container) return
    container.innerHTML = html
    if (callback) callback()
  } catch (error) {
    console.error(`Error al cargar componente: ${path}`, error)
  }
}

async function initCheckout() {
  // Запускаемся только там, где есть форма оформления
  const form = document.getElementById("checkout-form")
  if (!form) return

  try {
    const cart = getCart()
    console.log("🛒 Carrito:", cart)

    if (!cart || cart.length === 0) {
      console.warn("Carrito vacío, redirigiendo...")
      window.location.href = "/cart.html"
      return
    }

    const orderItemsContainer = document.getElementById("order-items")
    if (orderItemsContainer) {
      orderItemsContainer.innerHTML = renderCartItems(cart)
    }

    updateTotals(cart)
    setupFormListeners(cart)

    // было: document.getElementById("checkout-form").addEventListener(...)
    form.addEventListener("submit", (e) => handleSubmit(e, cart))

  } catch (error) {
    console.error("Checkout init error:", error)
    showError("Error al cargar la página de pago")
  }
}

// ==================== RENDER FUNCTIONS ====================

function updateTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  
  // Получить shipping метод
  const shippingInput = document.querySelector('input[name="shipping"]')
  const shippingMethod = shippingInput ? shippingInput.value : "standard"
  const shippingCost = shippingCosts[shippingMethod] || 0
  
  // Применить скидку к subtotal
  const discount = Math.round(subtotal * (discountPercent / 100))
  const subtotalAfterDiscount = subtotal - discount
  const total = subtotalAfterDiscount + shippingCost

  const formatter = new Intl.NumberFormat("es-CO")

  // ✅ ПРОВЕРЯЙ НАЛИЧИЕ элемента перед использованием!
  const subtotalEl = document.getElementById("subtotal")
  const shippingCostEl = document.getElementById("shipping-cost")
  const totalEl = document.getElementById("total")
  const submitBtn = document.getElementById("submit-btn")

  if (subtotalEl) {
    if (discountPercent > 0) {
      subtotalEl.innerHTML = `<div style="text-decoration: line-through; opacity: 0.6;">$${formatter.format(subtotal)}</div><div style="color: #4caf50; font-weight: 500;">$${formatter.format(subtotalAfterDiscount)}</div>`
    } else {
      subtotalEl.textContent = `$${formatter.format(subtotal)}`
    }
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

  console.log(`✅ Totales: Subtotal=$${formatter.format(subtotal)}, Descuento=$${formatter.format(discount)}, Envío=$${formatter.format(shippingCost)}, Total=$${formatter.format(total)}`)
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

  // ==================== PROMO CODE LISTENERS ====================
  const promoInput = document.getElementById("promo-code")
  const applyPromoBtn = document.getElementById("apply-promo-btn")

  if (applyPromoBtn) {
    applyPromoBtn.addEventListener("click", async (e) => {
      e.preventDefault()
      const code = promoInput.value.trim().toUpperCase()
      
      if (!code) {
        showPromoError("Ingresa un código de promoción")
        return
      }

      await validateAndApplyPromo(code, cart)
    })
  }

  // Allow Enter key in promo input
  if (promoInput) {
    promoInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const code = promoInput.value.trim().toUpperCase()
        
        if (!code) {
          showPromoError("Ingresa un código de promoción")
          return
        }

        await validateAndApplyPromo(code, cart)
      }
    })
  }
}

// ==================== PROMO CODE FUNCTIONS ====================

async function validateAndApplyPromo(code, cart) {
  try {
    // Очистить старые ошибки перед новой попыткой
    clearPromoError()
    
    console.log(`🔍 Validando código de promoción: ${code}`)
    
    // Buscar el código en Strapi
    const response = await fetch(`${API_URL}/api/promo-codes?filters[code][$eqi]=${code}&filters[is_active][$eq]=true`)
    
    if (!response.ok) {
      throw new Error("Error al validar promoción")
    }

    const data = await response.json()
    console.log("📋 Respuesta de Strapi:", data)

    // Verificar si el código existe y está activo
    if (!data.data || data.data.length === 0) {
      showPromoError("Código de promoción no válido o inactivo")
      return
    }

    const promoData = data.data[0]
    const today = new Date().toISOString().split('T')[0]

    // Validar fechas si existen
    if (promoData.valid_from && promoData.valid_from > today) {
      showPromoError("Este código aún no está disponible")
      return
    }

    if (promoData.valid_until && promoData.valid_until < today) {
      showPromoError("Este código ha expirado")
      return
    }

    // Validar monto mínimo de compra si existe
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    if (promoData.min_purchase_amount && subtotal < promoData.min_purchase_amount) {
      const formatter = new Intl.NumberFormat("es-CO")
      showPromoError(`Monto mínimo de compra: $${formatter.format(promoData.min_purchase_amount)}`)
      return
    }

    // ✅ Aplicar descuento
    appliedPromoCode = code
    discountPercent = promoData.discount_percent || 0

    console.log(`✅ Promoción aplicada: ${code} (${discountPercent}% descuento)`)

    // Mostrar éxito
    showPromoSuccess(`¡Código aplicado! ${discountPercent}% descuento`)
    
    // Mostrar badge de descuento
    const discountInfo = document.getElementById("discount-info")
    if (discountInfo) {
      discountInfo.style.display = "block"
      const discountPercentEl = document.getElementById("discount-percent")
      if (discountPercentEl) {
        discountPercentEl.textContent = `${discountPercent}%`
      }
    }

    // Actualizar totales
    updateTotals(cart)

    // Deshabilitar botón de aplicar y input
    const promoInput = document.getElementById("promo-code")
    const applyBtn = document.getElementById("apply-promo-btn")
    
    if (promoInput) promoInput.disabled = true
    if (applyBtn) applyBtn.disabled = true

  } catch (error) {
    console.error("❌ Error validando promoción:", error)
    showPromoError("Error al validar el código. Intenta de nuevo.")
    return
  }
}

function clearPromoCode(cart) {
  appliedPromoCode = null
  discountPercent = 0

  const discountInfo = document.getElementById("discount-info")
  if (discountInfo) {
    discountInfo.style.display = "none"
  }

  const promoInput = document.getElementById("promo-code")
  const applyBtn = document.getElementById("apply-promo-btn")
  
  if (promoInput) {
    promoInput.disabled = false
    // НЕ очищай поле при ошибке! Пусть пользователь сам исправит
    // promoInput.value = ""  // ← закомментируй эту строку
  }
  if (applyBtn) applyBtn.disabled = false

  clearPromoError()
  updateTotals(cart)
}

function showPromoError(message) {
  const errorEl = document.getElementById("promo-code-error")
  const successEl = document.getElementById("promo-code-success")
  
  if (errorEl) {
    errorEl.textContent = message
    errorEl.classList.add("show")  // ← просто добавляем класс
  }
  
  if (successEl) {
    successEl.textContent = ""
  }
}

function showPromoSuccess(message) {
  const errorEl = document.getElementById("promo-code-error")
  const successEl = document.getElementById("promo-code-success")
  
  if (errorEl) {
    errorEl.textContent = ""
    errorEl.classList.remove("show")  // ← удаляем класс
  }
  
  if (successEl) {
    successEl.textContent = message
  }
}

function clearPromoError() {
  const errorEl = document.getElementById("promo-code-error")
  const successEl = document.getElementById("promo-code-success")
  
  if (errorEl) {
    errorEl.textContent = ""
    errorEl.classList.remove("show")  // ← удаляем класс
  }
  if (successEl) {
    successEl.textContent = ""
  }
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
      console.log(`✅ Agregada clase error-active para ${field}`)  // для проверки
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
      
      // ✅ СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ONESIZE ТОВАРОВ
      let availableStock = 0
      if (item.size === "onesize") {
        // Для onesize товаров берем сток из xxs
        availableStock = stock['xxs'] || 0
      } else {
        // Для обычных товаров берем по размеру
        availableStock = stock[item.size.toLowerCase()] || 0
      }

      // Проверяй наличие
      if (availableStock < item.quantity) {
        showError(`❌ ${item.title} (${item.size}) - solo hay ${availableStock} en stock, pero quieres ${item.quantity}`)
        return false
      }

      console.log(`✅ ${item.title} (${item.size}): ${availableStock} disponibles`)
    }

    return true

  } catch (error) {
    console.error("Stock validation error:", error)
    showError("Error al verificar el stock del producto")
    return false
  }
}

async function handleSubmit(e, cart) {
  e.preventDefault()

  // Validate stock
  const stockValid = await validateStock(cart)
  if (!stockValid) return

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
    console.log("🔄 Creando pedido...")
    const order = await createOrder(cart)

    // v5 → documentId; если v4, documentId не будет и возьмётся числовой id
    const orderRef = order.data.documentId || order.data.id
    console.log("✅ Pedido creado! Ref:", orderRef)

    // 2️⃣ Перенаправляем на Web Checkout Wompi (один клик, без отдельной кнопки)
    submitBtn.textContent = "Redirigiendo al pago..."
    await redirectToWompi(cart, orderRef)

  } catch (error) {
    console.error("Order creation error:", error)
    showError("Error al crear el pedido. Por favor intenta de nuevo.")
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

// ==================== WOMPI PAYMENT (Web Checkout - redirección) ====================
//
// Un solo clic: "Confirmar Pedido" crea el pedido en Strapi y luego redirige
// directamente al checkout alojado por Wompi. No hay botón aparte ni SDK que cargar.

async function redirectToWompi(cart, orderId) {
  const shippingMethod = document.querySelector('input[name="shipping"]').value || "standard"

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shippingCost = shippingCosts[shippingMethod] || 0
  const discount = Math.round(subtotal * (discountPercent / 100))
  const total = (subtotal - discount) + shippingCost

  localStorage.setItem("lastOrderTotal", String(total)) // ← для Pixel на странице подтверждения

  // ⚠️ Wompi maneja los montos en CENTAVOS (total en pesos × 100).
  const amountInCents = Math.round(total * 100)
  const reference = `ORD-${orderId}`

  console.log("🔄 Generando firma de integridad...", { reference, amountInCents })

  // 1️⃣ Firma de integridad desde el backend (SHA256 con el secreto de integridad).
  //    DEBE calcularse con el mismo amountInCents/reference/currency que enviamos abajo.
  const signRes = await fetch(`/.netlify/functions/wompi-signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, amountInCents, currency: "COP" })
  })

  if (!signRes.ok) {
    throw new Error(`No se pudo generar la firma (HTTP ${signRes.status})`)
  }

  const { signature } = await signRes.json()
  if (!signature) throw new Error("El backend no devolvió la firma de integridad")

  console.log("✅ Firma recibida")

  // 2️⃣ Datos del comprador/envío para pre-llenar el checkout de Wompi (opcional pero útil).
  const f = collectFormData()

  // 3️⃣ Parámetros del Web Checkout. Los obligatorios son los 5 primeros.
  const params = {
    "public-key": WOMPI_CONFIG.PUBLIC_KEY,
    "currency": "COP",
    "amount-in-cents": String(amountInCents),
    "reference": reference,
    "signature:integrity": signature,
    // --- opcionales ---
    "redirect-url": `${window.location.origin}/pages/order-confirmation.html?order_id=${orderId}`,
    "customer-data:email": f.email,
    "customer-data:full-name": `${f.firstName} ${f.lastName}`.trim(),
    "customer-data:phone-number": f.phone,
    "shipping-address:address-line-1": f.street + (f.apartment ? `, ${f.apartment}` : ""),
    "shipping-address:city": f.city,
    "shipping-address:region": f.state,
    "shipping-address:country": "CO",
    "shipping-address:phone-number": f.phone
  }

  // 4️⃣ Construir un <form method="GET"> y enviarlo → redirige a Wompi.
  const form = document.createElement("form")
  form.method = "GET"
  form.action = WOMPI_CHECKOUT_URL

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  console.log("➡️ Redirigiendo a Wompi Web Checkout...")
  form.submit()
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
    const shippingMethod = document.querySelector('input[name="shipping"]').value || "standard"
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shippingCost = shippingCosts[shippingMethod] || 0
    
    // Aplicar descuento al subtotal
    const discount = Math.round(subtotal * (discountPercent / 100))
    const subtotalAfterDiscount = subtotal - discount
    const total = subtotalAfterDiscount + shippingCost

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
        discount,
        shippingCost,
        total,

        // Promo code (if applied)
        ...(appliedPromoCode && {
          promoCode: appliedPromoCode,
          discountPercent: discountPercent
        })
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
      throw new Error(errorData.error?.message || "La creación del pedido falló")
    }

    const result = await response.json()
    console.log("✅ Pedido creado:", result)

    return result

  } catch (error) {
    console.error("Error al crear pedido:", error)
    throw error
  }
}

// ==================== PAYMENT CONFIRMATION ====================
// ✅ НОВАЯ ФУНКЦИЯ: обновить заказ с данными платежа

export async function updateOrderWithPayment(orderId, paymentData) {
  const updateData = {
    data: {
      orderStatus: "paid",                          // значение ДОЛЖНО быть в enum поля orderStatus
      paymentId: String(paymentData.paymentId || ""),       // text
      paymentMethod: String(paymentData.paymentMethod || "Wompi"), // text
      paidAt: new Date().toISOString(),             // datetime, ISO-8601 — Strapi принимает
      paymentDetails: paymentData                   // JSON-поле принимает объект как есть
    }
  }

  // ⚠️ Strapi v5: orderId здесь должен быть documentId, не числовой id!
  const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `Update falló: HTTP ${response.status}`)
  }
  return response.json()
}

// ✅ НОВАЯ ФУНКЦИЯ: обновить сток в Google Sheets после успешного платежа

export async function updateStockAfterPayment(cart, orderId) {
  try {
    console.log("🔄 Actualizando stock en Google Sheets...")

    for (const item of cart) {
      // Вычитай количество из стока
      const updateData = {
        productId: item.id,
        size: item.size,
        quantityDecrement: item.quantity,
        orderId: orderId,
        reason: "payment_completed"
      }

      const response = await fetch(`/.netlify/functions/update-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        console.warn(`⚠️ Error al actualizar stock para ${item.title}`)
        continue
      }

      const result = await response.json()
      console.log(`✅ Stock actualizado para ${item.title}:`, result)
    }

    return true

  } catch (error) {
    console.error("Error al actualizar stock:", error)
    return false
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