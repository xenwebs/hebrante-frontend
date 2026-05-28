// pages/order-confirmation.js

import { getCart, clearCart } from "./cart.js"
import { updateOrderWithPayment, updateStockAfterPayment } from "./checkout.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Получи order_id из URL
    const urlParams = new URLSearchParams(window.location.search)
    const orderId = urlParams.get("order_id")
    
    if (!orderId) {
      showError("ID de pedido no encontrado")
      return
    }

    console.log("✅ Procesando confirmación de pedido:", orderId)

    // Получи данные платежа из Bold (если disponibles)
    const paymentData = await getPaymentDataFromBold()

    if (!paymentData) {
      console.warn("⚠️ No se encontraron datos de pago de Bold")
    }

    // Получи корзину перед очисткой
    const cart = getCart()

    // 1️⃣ Обнови заказ в Strapi с данными платежа
    console.log("🔄 Actualizando pedido en Strapi...")
    await updateOrderWithPayment(orderId, paymentData || {})

    // 2️⃣ Обнови сток в Google Sheets
    console.log("🔄 Actualizando stock en Google Sheets...")
    const stockUpdated = await updateStockAfterPayment(cart, orderId)

    // 3️⃣ Очисти корзину
    clearCart()
    console.log("✅ Carrito vaciado")

    // 4️⃣ Покажи успешное сообщение
    showSuccess(orderId, paymentData)

  } catch (error) {
    console.error("❌ Error en order confirmation:", error)
    showError(`Error procesando tu pedido: ${error.message}`)
  }
})

// Получи данные платежа из window (Bold может их передать)
async function getPaymentDataFromBold() {
  try {
    // Bold может передать данные через window.boldPaymentData или similar
    // Это зависит от того как настроена интеграция Bold
    
    // Попробуй получить из URL параметров (если Bold редиректит с ними)
    const urlParams = new URLSearchParams(window.location.search)
    
    const paymentData = {
      paymentId: urlParams.get("transactionId") || urlParams.get("paymentId") || "",
      paymentMethod: "Bold",
      status: urlParams.get("status") || "completed",
      amount: urlParams.get("amount") || "",
      reference: urlParams.get("reference") || ""
    }

    // Если есть глобальный объект из Bold
    if (window.boldPayment) {
      paymentData.paymentId = window.boldPayment.transactionId || paymentData.paymentId
      paymentData.status = window.boldPayment.status || paymentData.status
    }

    console.log("💳 Datos de pago obtenidos:", paymentData)
    return paymentData

  } catch (error) {
    console.warn("⚠️ Error al obtener datos de pago:", error)
    return null
  }
}

function showSuccess(orderId, paymentData = {}) {
  // send action to Meta Pixel
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Purchase', {
      value: paymentData.amount || 0,
      currency: 'COP',
      contents: [{}],
    });
    console.log("✅ Evento de compra enviado a Meta Pixel");
  } else {
    console.warn("⚠️ Meta Pixel no está disponible");
  }

  // 👆 META PIXEL END
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
||

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