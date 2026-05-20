const sgMail = require('@sendgrid/mail')

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method not allowed'
      })
    }
  }

  try {
    const { orderId } = JSON.parse(event.body)

    console.log("📦 ORDER ID:", orderId)

    // 1️⃣ Получаем заказ из Strapi
    const orderRes = await fetch(
      `https://proper-gem-a18dd78c57.strapiapp.com/api/orders/${orderId}`
    )

    const orderData = await orderRes.json()

    const order = orderData.data

    // 2️⃣ Данные заказа
    const email = order.email
    const firstName = order.firstName
    const lastName = order.lastName
    const total = order.total
    const items = order.items || []

    // 3️⃣ HTML товаров
    const itemsList = items.map(item => `
      <li>
        ${item.title} (${item.size})
        x${item.quantity}
      </li>
    `).join('')

    // 4️⃣ Email
    const msg = {
      to: email,

      from: 'hebrantecolombia@gmail.com',

      subject: `Confirmación de pedido #${orderId}`,

      html: `
        <h2>¡Gracias por tu pedido!</h2>

        <p>
          Hola ${firstName} ${lastName},
        </p>

        <h3>
          Pedido #${orderId}
        </h3>

        <ul>
          ${itemsList}
        </ul>

        <p>
          <strong>
            Total:
            $${Number(total).toLocaleString('es-CO')} COP
          </strong>
        </p>
      `
    }

    // 5️⃣ Отправка
    await sgMail.send(msg)

    console.log("✅ Email enviado")

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true
      })
    }

  } catch (error) {
    console.error("❌ ERROR:", error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    }
  }
}