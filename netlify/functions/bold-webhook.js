const crypto = require("crypto")

// ── Переменные окружения (задаются в Netlify, НЕ в коде) ──
// Site settings → Environment variables
const BOLD_IDENTITY_KEY = process.env.BOLD_IDENTITY_KEY   // «Llave de identidad» из панели Bold
const STRAPI_URL        = process.env.STRAPI_URL          // https://proper-gem-...strapiapp.com
const STRAPI_API_TOKEN  = process.env.STRAPI_API_TOKEN    // API-токен Strapi с правом update на order

exports.handler = async (event) => {
  // 1️⃣ Принимаем только POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  // 2️⃣ Берём СЫРОЕ тело (важно — именно как пришло, без повторной сериализации)
  const rawBody = event.body || ""

  // 3️⃣ Достаём подпись из заголовка (в Netlify ключи заголовков в нижнем регистре)
  const signature = event.headers["x-bold-signature"] || ""

  // 4️⃣ Проверяем подпись по алгоритму Bold:
  //    body → Base64 → HMAC-SHA256 с Identity Key → hex → сравнить с заголовком
  const base64Body = Buffer.from(rawBody, "utf8").toString("base64")
  const expected = crypto
    .createHmac("sha256", BOLD_IDENTITY_KEY)
    .update(base64Body)
    .digest("hex")

  // timingSafeEqual требует одинаковую длину буферов, иначе бросает ошибку
  const sigBuf = Buffer.from(signature, "utf8")
  const expBuf = Buffer.from(expected, "utf8")
  const isValid =
    sigBuf.length === expBuf.length &&
    crypto.timingSafeEqual(sigBuf, expBuf)

  if (!isValid) {
    console.warn("⚠️ Firma de webhook inválida — petición rechazada")
    return { statusCode: 401, body: "Invalid signature" }
  }

  // 5️⃣ Парсим тело (теперь, когда подпись подтверждена)
  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { statusCode: 400, body: "Invalid JSON" }
  }

  console.log("📩 Evento Bold recibido:", payload.type, payload.subject)

  // 6️⃣ Реагируем только на одобренную продажу.
  //    Остальные типы (REJECTED / VOID) подтверждаем 200, но заказ не трогаем.
  if (payload.type !== "SALE_APPROVED") {
    return { statusCode: 200, body: "ignored" }
  }

  const data = payload.data || {}

  // 7️⃣ Находим заказ по референсу. В кнопку мы кладём data-order-id = "ORD-<documentId>".
  //    ВАЖНО: при первом тесте залогируй весь data, чтобы убедиться,
  //    в каком поле реально приходит твой ORD-xxx (metadata.reference или другое).
  const reference = data.metadata?.reference || ""
  const orderRef = reference.replace("ORD-", "")   // → documentId для Strapi v5

  if (!orderRef) {
    console.error("❌ No se encontró referencia del pedido en el webhook")
    return { statusCode: 200, body: "no reference" } // 200, чтобы Bold не ретраил бесконечно
  }

  // 8️⃣ Обновляем заказ в Strapi серверным токеном (публичный update НЕ открываем!)
  try {
    const res = await fetch(`${STRAPI_URL}/api/orders/${orderRef}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${STRAPI_API_TOKEN}`
      },
      body: JSON.stringify({
        data: {
          orderStatus: "paid",
          paymentId: String(data.payment_id || ""),
          paymentMethod: String(data.payment_method || "Bold"),
          paidAt: data.created_at || new Date().toISOString(),
          paymentDetails: data           // весь объект Bold в JSON-поле
        }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("❌ Error actualizando Strapi:", res.status, err)
      // 200, чтобы Bold не ретраил из-за нашей внутренней ошибки;
      // (по желанию — верни 500, тогда Bold попробует повторно)
      return { statusCode: 200, body: "strapi error logged" }
    }

    console.log("✅ Pedido", orderRef, "marcado como pagado")
    return { statusCode: 200, body: "ok" }

  } catch (e) {
    console.error("❌ Excepción en webhook:", e)
    return { statusCode: 200, body: "error logged" }
  }
}