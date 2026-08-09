// pages/order-confirmation.js

import { getCart, clearCart } from "./cart.js"

// ⚠️ El estado del pago (orderStatus, paymentId, paymentMethod, paidAt, paymentDetails)
//    ahora lo escribe el WEBHOOK de Bold en el backend, de forma confiable.
//    Esta página SOLO muestra la confirmación y dispara el evento Purchase de Meta Pixel.
//    Por eso ya NO importa ni llama a updateOrderWithPayment / updateStockAfterPayment.

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Obtener order_id de la URL
    const urlParams = new URLSearchParams(window.location.search)
    const orderId = urlParams.get("order_id")

    if (!orderId) {
      showError("ID de pedido no encontrado")
      return
    }

    console.log("✅ Procesando confirmación de pedido:", orderId)

    // Fijar el carrito ANTES de limpiarlo (lo necesita el Pixel)
    const cart = getCart()

    // Datos de pago solo para mostrar en pantalla (pueden venir vacíos en el frontend)
    const paymentData = await getPaymentDataFromBold()

    // Limpiar carrito
    clearCart()
    console.log("✅ Carrito vaciado")

    // Mostrar éxito + disparar Purchase en Meta Pixel
    showSuccess(orderId, paymentData || {}, cart)

  } catch (error) {
    console.error("❌ Error en order confirmation:", error)
    showError(`Error procesando tu pedido: ${error.message}`)
  }
})

// Datos de pago para mostrar (Bold normalmente NO los envía por URL,
// así que estos campos suelen venir vacíos; el dato real lo guarda el webhook)
async function getPaymentDataFromBold() {
  try {
    const urlParams = new URLSearchParams(window.location.search)

    const paymentData = {
      paymentId: urlParams.get("transactionId") || urlParams.get("paymentId") || "",
      paymentMethod: "Bold",
      status: urlParams.get("status") || "completed",
      amount: urlParams.get("amount") || "",
      reference: urlParams.get("reference") || ""
    }

    if (window.boldPayment) {
      paymentData.paymentId = window.boldPayment.transactionId || paymentData.paymentId
      paymentData.status = window.boldPayment.status || paymentData.status
    }

    console.log("💳 Datos de pago (solo display):", paymentData)
    return paymentData

  } catch (error) {
    console.warn("⚠️ Error al obtener datos de pago:", error)
    return null
  }
}

function showSuccess(orderId, paymentData = {}, items = []) {
  // Disparar evento Purchase de Meta Pixel
  firePurchase(orderId, items)

  const container = document.getElementById("order-confirmation") || document.body

  const successHTML = `
    <div class="success-container" style="
      max-width: 600px;
      margin: 40px auto;
      padding: 40px;
      background: #f0f7f4;
      border-radius: 12px;
      text-align: center;
      border-left: 4px solid #4caf50;
    ">
      <div style="font-size: 48px; margin-bottom: 20px;">✅</div>

      <h1 style="color: #2e7d32; margin: 0 0 10px 0; font-size: 28px;">
        ¡Pedido Confirmado!
      </h1>

      <p style="color: #666; font-size: 16px; margin: 10px 0;">
        Gracias por tu compra. Tu pedido ha sido procesado correctamente.
      </p>

      <div style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: left;
      ">
        <p style="margin: 10px 0;">
          <strong>Número de Pedido:</strong> <span style="color: #2e7d32; font-weight: bold;">#${orderId}</span>
        </p>

        ${paymentData.paymentId ? `
          <p style="margin: 10px 0;">
            <strong>ID de Transacción:</strong> ${paymentData.paymentId}
          </p>
        ` : ''}

        <p style="margin: 10px 0;">
          <strong>Estado:</strong> Pagado
        </p>
        <p style="margin: 10px 0; color: #999; font-size: 14px;">
          Fecha: ${new Date().toLocaleDateString('es-CO')}
        </p>
      </div>

      <p style="color: #666; font-size: 14px; margin: 20px 0;">
        Te enviaremos un email de confirmación a tu correo electrónico.
      </p>

      <button onclick="window.location.href='/'" style="
        background: #2e7d32;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
      ">
        Volver a la Tienda
      </button>
    </div>
  `

  container.innerHTML = successHTML
}

function firePurchase(orderId, items) {
  if (typeof fbq === "undefined") {
    console.warn("⚠️ Meta Pixel (fbq) no está cargado en esta página")
    return
  }

  // Protección contra envío duplicado al recargar la página
  const firedKey = `purchase_fired_${orderId}`
  if (sessionStorage.getItem(firedKey)) {
    console.log("ℹ️ Purchase ya enviado para este pedido")
    return
  }

  const total =
    Number(localStorage.getItem("lastOrderTotal")) ||
    items.reduce((s, it) => s + it.price * it.quantity, 0)

  fbq("track", "Purchase", {
    value: total,
    currency: "COP",
    content_type: "product",
    content_ids: items.map(it => String(it.id)),
    contents: items.map(it => ({
      id: String(it.id),
      quantity: it.quantity,
      item_price: it.price
    })),
    num_items: items.reduce((n, it) => n + it.quantity, 0)
  })

  sessionStorage.setItem(firedKey, "1")
  console.log("✅ Purchase enviado a Meta Pixel (value:", total, ")")
}

function showError(message) {
  const container = document.getElementById("order-confirmation") || document.body

  const errorHTML = `
    <div class="error-container" style="
      max-width: 600px;
      margin: 40px auto;
      padding: 40px;
      background: #ffebee;
      border-radius: 12px;
      text-align: center;
      border-left: 4px solid #d32f2f;
    ">
      <div style="font-size: 48px; margin-bottom: 20px;">❌</div>

      <h1 style="color: #c62828; margin: 0 0 10px 0; font-size: 24px;">
        Error en el Pedido
      </h1>

      <p style="color: #666; font-size: 16px; margin: 10px 0;">
        ${message}
      </p>

      <p style="color: #999; font-size: 14px; margin: 20px 0;">
        Si el problema persiste, contacta con nosotros.
      </p>

      <button onclick="window.location.href='/cart.html'" style="
        background: #d32f2f;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
      ">
        Volver al Carrito
      </button>
    </div>
  `

  container.innerHTML = errorHTML
}