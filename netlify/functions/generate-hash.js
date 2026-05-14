const crypto = require('crypto');

const BOLD_SECRET = "4BbFqkhy02M0KnWDa38xGw"

exports.handler = async (event) => {
  // Только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { orderId, amount, currency } = JSON.parse(event.body)

    console.log("📝 Генерирую хеш для:", { orderId, amount, currency })

    // Генерируй хеш точно как Bold требует
    const data = `${orderId}${amount}${currency}${BOLD_SECRET}`
    console.log("🔐 Строка для хеша:", data)

    const hash = crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')

    console.log("✅ Хеш:", hash)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        integritySignature: hash
      })
    }

  } catch (error) {
    console.error("❌ Error:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}