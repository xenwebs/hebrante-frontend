const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

const params = new URLSearchParams(window.location.search)
const orderId = params.get("order_id")

console.log("ORDER ID:", orderId)

if (orderId) {
  handleOrderSuccess(orderId)
}

// ==================== MAIN FLOW ====================

async function handleOrderSuccess(orderId) {
  await Promise.all([
    updateOrderInStrapi(orderId),
    sendConfirmationEmail(orderId)
  ])
}

// ==================== STRAPI UPDATE ====================

async function updateOrderInStrapi(orderId) {

  try {

    const paymentData = {
      paymentId: "BOLD_" + Date.now(),
      paymentMethod: "bold",
      paidAt: new Date().toISOString(),
      orderStatus: "paid"
    }

    const res = await fetch(`${API_URL}/api/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: paymentData
      })
    })

    const result = await res.json()

    console.log("✅ Order updated:", result)

  } catch (err) {
    console.error("❌ Failed to update order:", err)
  }
}

// ==================== EMAIL ====================

async function sendConfirmationEmail(orderId) {

  try {

    const response = await fetch('/.netlify/functions/send-order-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ orderId })
    })

    const data = await response.json()

    console.log("✅ Email sent:", data)

  } catch (error) {
    console.error("❌ Email error:", error)
  }
}