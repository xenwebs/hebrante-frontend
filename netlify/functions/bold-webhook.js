// netlify/functions/bold-webhook.js
const crypto = require("crypto")
 
const STRAPI_URL = process.env.STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN
// ⚠️ Es la LLAVE SECRETA (privada) de la integración "Botón de pagos", ambiente PRODUCCIÓN.
//    NO es la llave de identidad (esa es la pública / API key).
const BOLD_SECRET_KEY = (process.env.BOLD_SECRET_KEY || "").trim()
 
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }
 
  // 1) BYTES crudos del cuerpo
  const rawBytes = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8")
 
  // 2) Firma con las dos variantes posibles (la documentada es base64)
  const base64Body = rawBytes.toString("base64")
  const sigFromBase64 = crypto.createHmac("sha256", BOLD_SECRET_KEY).update(base64Body).digest("hex")
  const sigFromRaw    = crypto.createHmac("sha256", BOLD_SECRET_KEY).update(rawBytes).digest("hex")
 
  const signature = event.headers["x-bold-signature"] || ""
 
  // --- DIAGNÓSTICO (quitar cuando funcione) ---
  console.log("🔑 Largo de la llave:", BOLD_SECRET_KEY.length)
  console.log("📏 Body bytes:", rawBytes.length, "| isBase64Encoded:", event.isBase64Encoded)
  console.log("🔎 Firma recibida      :", signature)
  console.log("🔎 Calculada (base64)  :", sigFromBase64, sigFromBase64 === signature ? "✅ COINCIDE" : "")
  console.log("🔎 Calculada (body raw):", sigFromRaw, sigFromRaw === signature ? "✅ COINCIDE" : "")
  // --------------------------------------------
 
  const matches = (a) => {
    const ab = Buffer.from(a, "utf8")
    const sb = Buffer.from(signature, "utf8")
    return ab.length === sb.length && crypto.timingSafeEqual(ab, sb)
  }
  const isValid = matches(sigFromBase64) || matches(sigFromRaw)
 
  if (!isValid) {
    console.warn("⚠️ Firma inválida. Verifica que BOLD_SECRET_KEY sea la LLAVE SECRETA de 'Botón de pagos' (producción).")
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
    // 4) Leer el pedido (idempotencia + items para el stock)
    const getRes = await fetch(`${STRAPI_URL}/api/orders/${orderRef}`, {
      headers: { "Authorization": `Bearer ${STRAPI_API_TOKEN}` }
    })
    const order = (await getRes.json())?.data || {}
 
    if (order.orderStatus === "paid") {
      console.log("ℹ️ Pedido ya estaba pagado, no se repite")
      return { statusCode: 200, body: "already processed" }
    }
 
    // 5) Marcar como pagado + datos reales del pago
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
    console.log("✅ Pedido", orderRef, "pagado. payment_id:", data.payment_id)
 
    // 6) Descontar stock (best-effort)
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
 