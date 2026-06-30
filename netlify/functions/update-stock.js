// netlify/functions/update-stock.js
// Actualiza el stock en Google Sheets tras un pago exitoso.
//
// ⚠️ Usa una CUENTA DE SERVICIO (JWT → OAuth), NO una API key:
//    una API key solo lee hojas públicas y NO permite ESCRIBIR en Sheets.
//    La cuenta de servicio debe tener la hoja compartida como EDITOR.

const crypto = require("crypto")

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID
const SHEET_TAB = process.env.GOOGLE_SHEETS_TAB || "Stock"

// Credenciales de la cuenta de servicio (reutiliza las que ya usas para escribir en Sheets).
const SA_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL
const SA_PRIVATE_KEY = (
  process.env.GOOGLE_PRIVATE_KEY ||
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
  ""
).replace(/\\n/g, "\n") // en Netlify la llave suele guardarse con los \n escapados

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

// Crea un JWT firmado (RS256) y lo intercambia por un access_token de Google.
async function getAccessToken() {
  if (!SA_EMAIL || !SA_PRIVATE_KEY) {
    throw new Error(
      "Faltan credenciales de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)"
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claims = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(SA_PRIVATE_KEY)
  const jwt = `${unsigned}.${base64url(signature)}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`No se pudo obtener access_token: ${res.status} ${JSON.stringify(data)}`)
  }
  return data.access_token
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) }
  }

  try {
    const { productId, size, quantityDecrement, orderId } = JSON.parse(event.body)
    console.log(`📊 Actualizando stock para producto ${productId} (${size}): -${quantityDecrement} unidades`)

    if (!SPREADSHEET_ID) throw new Error("Falta GOOGLE_SHEETS_ID")

    const token = await getAccessToken()
    const authHeader = { Authorization: `Bearer ${token}` }
    const apiBase = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values`

    // 1️⃣ Leer la hoja (columnas A:F)
    const readRange = encodeURIComponent(`${SHEET_TAB}!A:F`)
    const getRes = await fetch(`${apiBase}/${readRange}`, { headers: authHeader })
    if (!getRes.ok) {
      throw new Error(`Google Sheets (lectura): ${getRes.status} ${await getRes.text()}`)
    }
    const getData = await getRes.json()
    const rows = getData.values || []
    console.log("📋 Filas encontradas en Google Sheets:", rows.length)

    // 2️⃣ Buscar la fila por productId + size
    let targetRowIndex = -1
    let currentStock = 0
    for (let i = 1; i < rows.length; i++) { // saltar encabezado
      const row = rows[i]
      if (row[0] === productId.toString() && row[2] === size) {
        targetRowIndex = i
        currentStock = parseInt(row[4]) || 0 // columna E = Cantidad
        console.log(`✅ Encontrado producto en fila ${i + 1}`)
        break
      }
    }

    if (targetRowIndex === -1) {
      console.warn(`⚠️ Producto ${productId} (${size}) no encontrado en Google Sheets`)
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Product not found in inventory", productId, size })
      }
    }

    // 3️⃣ Nuevo stock
    const newStock = Math.max(0, currentStock - quantityDecrement)
    const sheetRow = targetRowIndex + 1 // +1: la API es 1-indexada (la fila 1 es el encabezado)

    // 4️⃣ Escribir el nuevo stock en la columna E
    const stockRange = encodeURIComponent(`${SHEET_TAB}!E${sheetRow}`)
    const updateRes = await fetch(`${apiBase}/${stockRange}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[newStock]] })
    })
    if (!updateRes.ok) {
      throw new Error(`Google Sheets (escritura stock): ${updateRes.status} ${await updateRes.text()}`)
    }

    // 5️⃣ Actualizar la fecha en la columna F (best-effort)
    const now = new Date().toISOString().split("T")[0]
    const dateRange = encodeURIComponent(`${SHEET_TAB}!F${sheetRow}`)
    const dateRes = await fetch(`${apiBase}/${dateRange}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[now]] })
    })
    if (!dateRes.ok) {
      console.warn("⚠️ No se pudo actualizar la fecha de última actualización:", dateRes.status)
    }

    console.log(`✅ Stock actualizado: ${currentStock} → ${newStock}`)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        productId,
        size,
        previousStock: currentStock,
        newStock,
        decrementedBy: quantityDecrement,
        orderId,
        updatedAt: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error("❌ Error en update-stock:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Error al actualizar el stock" })
    }
  }
}