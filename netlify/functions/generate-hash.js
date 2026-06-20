const crypto = require('crypto');

const BOLD_SECRET = "4BbFqkhy02M0KnWDa38xGw"

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { orderId, amount, currency } = JSON.parse(event.body)

    console.log("📝 Генерирую хеш для:", { orderId, amount, currency })

    // Точно как Bold пример
    const concatenate = orderId + amount + currency + BOLD_SECRET
    console.log("🔐 Строка для хеша:", concatenate)

    const hash = crypto
      .createHash('sha256')
      .update(concatenate)
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