import crypto from 'node:crypto';

const BOLD_SECRET = (process.env.BOLD_SECRET_KEY || '').trim();

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { orderId, amount, currency } = JSON.parse(event.body);

    console.log('📝 Генерирую хеш для:', { orderId, amount, currency });

    if (!BOLD_SECRET) {
      console.error('❌ BOLD_SECRET_KEY не задан в окружении');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Configuration error' })
      };
    }

    const concatenate = orderId + amount + currency + BOLD_SECRET;

    const hash = crypto
      .createHash('sha256')
      .update(concatenate)
      .digest('hex');

    console.log('✅ Хеш сгенерирован для заказа:', orderId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        integritySignature: hash
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};