const params = new URLSearchParams(window.location.search)
const orderId = params.get("order_id")

console.log("ORDER ID:", orderId)

if (orderId) {
  sendConfirmationEmail(orderId)
}

async function sendConfirmationEmail(orderId) {
  try {
    const response = await fetch('/.netlify/functions/send-order-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        orderId
      })
    })

    const data = await response.json()

    console.log("✅ Email sent:", data)

  } catch (error) {
    console.error("❌ Email error:", error)
  }
}