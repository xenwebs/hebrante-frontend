// netlify/functions/wompi-signature.js
//
// Genera la "firma de integridad" (integrity signature) que Wompi exige
// para abrir el Web Checkout. Es el equivalente al generate-hash de Bold.
//
// ⚠️ Usa el SECRETO DE INTEGRIDAD (Desarrolladores > Secretos para integración técnica).
//    NO es el secreto de eventos, NI la llave pública.
//    Sandbox:    test_integrity_...
//    Producción: prod_integrity_...
//
// La firma SIEMPRE se calcula en el servidor para no exponer el secreto en el frontend.

const crypto = require("crypto")

const WOMPI_INTEGRITY_SECRET = (process.env.WOMPI_INTEGRITY_SECRET || "").trim()

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  try {
    const { reference, amountInCents, currency = "COP", expirationTime } =
      JSON.parse(event.body || "{}")

    if (!reference || !amountInCents) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan 'reference' o 'amountInCents'" })
      }
    }

    if (!WOMPI_INTEGRITY_SECRET) {
      console.error("❌ Falta la variable de entorno WOMPI_INTEGRITY_SECRET")
      return { statusCode: 500, body: JSON.stringify({ error: "Servidor sin secreto de integridad" }) }
    }

    // ⚠️ EL ORDEN IMPORTA (así lo exige Wompi):
    //    reference + amountInCents + currency [+ expirationTime] + secretoIntegridad
    let toSign = `${reference}${amountInCents}${currency}`
    if (expirationTime) toSign += expirationTime
    toSign += WOMPI_INTEGRITY_SECRET

    const signature = crypto.createHash("sha256").update(toSign).digest("hex")

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature })
    }
  } catch (e) {
    console.error("❌ Error generando la firma de Wompi:", e)
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}