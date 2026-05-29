// netlify/functions/bold-webhook.js
const crypto = require("crypto")
 
const STRAPI_URL = process.env.STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN
// "Llave de identidad" del panel de Bold (Integraciones).
// .trim() por si quedó un espacio o salto de línea al pegarla en Netlify.
const BOLD_IDENTITY_KEY = (process.env.BOLD_IDENTITY_KEY || "").trim()
 
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }
 
  // 1) BYTES crudos del cuerpo (Netlify a veces los entrega ya en base64)
  const rawBytes = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8")
 
  // 2) Algoritmo EXACTO de Bold: base64(body) -> HMAC-SHA256 (hex) con la llave de identidad
  const base64Body = rawBytes.toString("base64")
  const expected = crypto
    .createHmac("sha256", BOLD_IDENTITY_KEY)
    .update(base64Body)
    .digest("hex")
 
  const signature = event.headers["x-bold-signature"] || ""
 
  // --- LOGS DE DIAGNÓSTICO (quítalos cuando ya funcione) ---
  console.log("🔑 Largo de la llave de identidad:", BOLD_IDENTITY_KEY.length)
  console.log("🔎 Firma recibida :", signature)
  console.log("🔎 Firma calculada:", expected)
  // ---------------------------------------------------------
 
  const sigBuf = Buffer.from(signature, "utf8")
  const expBuf = Buffer.from(expected, "utf8")
  const isValid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
 
  if (!isValid) {
    console.warn("⚠️ Firma de webhook inválida — petición rechazada")
    return { statusCode: 401, body: "Invalid signature" }
  }
 
  // 3) Parsear (ya validado)
  let payload
  try {
    payload = JSON.parse(rawBytes.toString("utf8"))
  } catch {
    return { statusCode: 400, body: "Invalid JSON" }
  }
 
  console.log("📩 Evento Bold:", payload.type)
  // Primera vez: confirma en qué campo viene tu ORD-xxx
  console.log("📦 data:", JSON.stringify(payload.data))
 
  if (payload.type !== "SALE_APPROVED") {
    return { statusCode: 200, body: "ignored" }
  }
 
  const data = payload.data || {}
  const reference = data.metadata?.reference || ""
  const orderRef = reference.replace("ORD-", "")
 
  if (!orderRef) {
    console.error("❌ Sin referencia de pedido (ORD-xxx) en el webhook")
    return { statusCode: 200, body: "no reference" }
  }
 
  try {
    // 4) Leer el pedido: para idempotencia y para obtener los items (stock)
    const getRes = await fetch(`${STRAPI_URL}/api/orders/${orderRef}`, {
      headers: { "Authorization": `Bearer ${STRAPI_API_TOKEN}` }
    })
    const order = (await getRes.json())?.data || {}
 
    // Idempotencia: Bold puede reintentar. Si ya está pagado, no repetir.
    if (order.orderStatus === "paid") {
      console.log("ℹ️ Pedido ya estaba pagado, no se repite")
      return { statusCode: 200, body: "already processed" }
    }
 
    // 5) Marcar como pagado + guardar datos reales del pago
    const putRes = await fetch(`${STRAPI_URL}/api/orders/${orderRef}`, {
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
          paymentDetails: data
        }
      })
    })
 
    if (!putRes.ok) {
      console.error("❌ Error actualizando Strapi:", putRes.status, await putRes.text())
      return { statusCode: 200, body: "strapi error logged" }
    }
    console.log("✅ Pedido", orderRef, "marcado como pagado. payment_id:", data.payment_id)
 
    // 6) Descontar stock (best-effort: si falla NO rompe el pago)
    const items = order.items || []
    const host = event.headers.host
    for (const item of items) {
      try {
        const r = await fetch(`https://${host}/.netlify/functions/update-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: item.id,
            size: item.size,
            quantityDecrement: item.quantity,
            orderId: orderRef,
            reason: "payment_completed"
          })
        })
        if (!r.ok) console.warn("⚠️ update-stock devolvió", r.status, "para", item.title)
      } catch (e) {
        console.warn("⚠️ No se pudo descontar stock de", item.title, e.message)
      }
    }
 
    return { statusCode: 200, body: "ok" }
 
  } catch (e) {
    console.error("❌ Excepción en webhook:", e)
    return { statusCode: 200, body: "error logged" }
  }
}
 