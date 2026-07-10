// netlify/functions/wompi-webhook.js
//
// Reemplaza a bold-webhook.js. Es la ÚNICA fuente de verdad del pago:
// Wompi nos avisa por aquí cuando una transacción llega a estado final.
// La redirección del navegador NO se usa para validar (puede manipularse);
// solo este webhook confirma el pago.
//
// Verificación de la firma de Wompi (checksum):
//   SHA256( valores de signature.properties (en orden) + timestamp + SECRETO_DE_EVENTOS )
//
// ⚠️ WOMPI_EVENTS_SECRET = secreto de EVENTOS (Desarrolladores > Secretos para integración técnica).
//    NO es el de integridad ni la llave pública.
//    Sandbox: test_events_...  | Producción: prod_events_...

const crypto = require("crypto")

const STRAPI_URL = process.env.STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN
const WOMPI_EVENTS_SECRET = (process.env.WOMPI_EVENTS_SECRET || "").trim()

// fetch con timeout: evita que una llamada lenta a Strapi cuelgue toda la función.
async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  // 1) Parsear el cuerpo
  let body
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "")
    body = JSON.parse(raw)
  } catch {
    return { statusCode: 400, body: "Invalid JSON" }
  }

  // 2) Verificar el checksum (firma de Wompi)
  const signature = body.signature || {}
  const properties = signature.properties || []
  const receivedChecksum = (signature.checksum || "").toUpperCase()

  // Concatenar, EN ORDEN, los valores que apunta signature.properties dentro de body.data,
  // luego el timestamp del evento, y por último el secreto de eventos.
  const concatenated =
    properties
      .map((path) =>
        path.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), body.data)
      )
      .join("") +
    body.timestamp +
    WOMPI_EVENTS_SECRET

  const localChecksum = crypto.createHash("sha256").update(concatenated).digest("hex").toUpperCase()

  // --- DIAGNÓSTICO (quitar cuando funcione) ---
  console.log("🔎 Propiedades firmadas:", JSON.stringify(properties))
  console.log("🔎 Checksum recibido :", receivedChecksum)
  console.log("🔎 Checksum calculado:", localChecksum, localChecksum === receivedChecksum ? "✅ COINCIDE" : "❌ NO COINCIDE")
  // --------------------------------------------

  const a = Buffer.from(localChecksum, "utf8")
  const b = Buffer.from(receivedChecksum, "utf8")
  const isValid = a.length === b.length && crypto.timingSafeEqual(a, b)

  if (!isValid) {
    console.warn("⚠️ Firma inválida. Revisa que WOMPI_EVENTS_SECRET sea el secreto de EVENTOS del ambiente correcto (test/prod).")
    return { statusCode: 401, body: "Invalid signature" }
  }

  // 3) Solo procesamos transacciones que llegaron a APPROVED
  const tx = (body.data && body.data.transaction) || {}
  console.log("📩 Evento Wompi:", body.event, "| status:", tx.status)

  if (body.event !== "transaction.updated" || tx.status !== "APPROVED") {
    // DECLINED / VOIDED / ERROR / etc. → 200 para que Wompi no reintente
    return { statusCode: 200, body: "ignored" }
  }

  const reference = tx.reference || ""
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
      // Wompi REINTENTE el webhook más tarde, en vez de perder el pedido.
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
            paymentId: String(tx.id || ""),
            paymentMethod: String(tx.payment_method_type || "Wompi"),
            paidAt: tx.finalized_at || tx.created_at || body.sent_at || new Date().toISOString(),
            paymentDetails: tx
          }
        })
      })
    } catch (e) {
      console.error("❌ Timeout/Error marcando como pagado:", e.message)
      return { statusCode: 503, body: "strapi unavailable, please retry" }
    }

    if (!putRes.ok) {
      console.error("❌ Error actualizando Strapi:", putRes.status, await putRes.text())
      // 503 para que Wompi reintente cuando Strapi esté disponible.
      return { statusCode: 503, body: "strapi update failed, please retry" }
    }
    console.log("✅ Pedido", orderRef, "pagado. transaction_id:", tx.id)

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