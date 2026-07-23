// netlify/functions/bold-webhook.js
import crypto from "node:crypto"

const STRAPI_URL = process.env.STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN
// ⚠️ Es la LLAVE SECRETA (privada) de la integración "Botón de pagos", ambiente PRODUCCIÓN.
//    NO es la llave de identidad (esa es la pública / API key).
const BOLD_SECRET_KEY = (process.env.BOLD_SECRET_KEY || "").trim()

// fetch con timeout: evita que una llamada lenta a Strapi cuelgue toda la función
// (antes se quedaba esperando hasta el límite de 30s y perdía el pedido).
async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  if (!BOLD_SECRET_KEY) {
    console.error("❌ BOLD_SECRET_KEY no está configurada en el entorno")
    return { statusCode: 500, body: "Configuration error" }
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
    let order
    try {
      const getRes = await fetchWithTimeout(`${STRAPI_URL}/api/orders/${orderRef}`, {
        headers: { "Authorization": `Bearer ${STRAPI_API_TOKEN}` }
      })
      order = (await getRes.json())?.data || {}
    } catch (e) {
      // Strapi lento o caído (p.ej. en pleno redeploy): devolvemos 503 para que
      // Bold REINTENTE el webhook más tarde, en vez de perder el pedido.
      console.error("❌ No se pudo leer el pedido de Strapi (¿caído/redeploy?):", e.message)
      return { statusCode: 503, body: "strapi unavailable, please retry" }
    }

    if (order.orderStatus === "paid") {
      console.log("ℹ️ Pedido ya estaba pagado, no se repite")
      return { statusCode: 200, body: "already processed" }
    }

    // 5) Marcar como pagado + datos reales del pago
    let putRes
    try {
      putRes = await fetchWithTimeout(`${STRAPI_URL}/api/orders/${orderRef}`, {
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
    } catch (e) {
      // No se pudo marcar como pagado: 503 para que Bold reintente.
      console.error("❌ Timeout/Error marcando como pagado:", e.message)
      return { statusCode: 503, body: "strapi unavailable, please retry" }
    }

    if (!putRes.ok) {
      console.error("❌ Error actualizando Strapi:", putRes.status, await putRes.text())
      // Antes devolvía 200 (Bold no reintentaba y el pedido quedaba 'pending' para siempre).
      // Ahora 503 para que Bold reintente cuando Strapi esté disponible.
      return { statusCode: 503, body: "strapi update failed, please retry" }
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

    // 7) Crear el envío en Envia (Deprisa) — best-effort
    //    Se hace DESPUÉS de confirmar el pago. Si falla, el webhook igual
    //    responde 200 (para que Bold no reintente) y el error queda en los logs.
    try {
      const shipRes = await fetch(`https://${host}/.netlify/functions/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderRef })
      })
      const shipData = await shipRes.json().catch(() => ({}))
      if (shipRes.ok && shipData.success) {
        console.log("✅ Envío creado. Guía:", shipData.trackingNumber)
      } else {
        console.warn("⚠️ create-shipment respondió", shipRes.status, JSON.stringify(shipData))
      }
    } catch (e) {
      console.warn("⚠️ No se pudo crear el envío:", e.message)
    }

    // 8) Enviar email de confirmación al cliente — best-effort
    try {
      const mailRes = await fetch(`https://${host}/.netlify/functions/send-order-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderRef })
      })
      if (mailRes.ok) {
        console.log("✅ Email de confirmación enviado")
      } else {
        console.warn("⚠️ send-order-email devolvió", mailRes.status)
      }
    } catch (e) {
      console.warn("⚠️ No se pudo enviar el email:", e.message)
    }

    return { statusCode: 200, body: "ok" }

  } catch (e) {
    console.error("❌ Excepción en webhook:", e)
    return { statusCode: 200, body: "error logged" }
  }
}