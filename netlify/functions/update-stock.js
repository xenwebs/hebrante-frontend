// netlify/functions/update-stock.js
// Функция для обновления стока в Google Sheets после успешного платежа

exports.handler = async (event) => {
  // Только POST запросы
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    }
  }

  try {
    const { productId, size, quantityDecrement, orderId } = JSON.parse(event.body)

    console.log(`📊 Actualizando stock para producto ${productId} (${size}): -${quantityDecrement} unidades`)

    // 🔑 Получи Google Sheets API ключ из переменных окружения
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID
    const RANGE = "Stock!A:F" // Диапазон для чтения и записи

    if (!GOOGLE_SHEETS_API_KEY || !SPREADSHEET_ID) {
      throw new Error("Missing Google Sheets configuration")
    }

    // 1️⃣ Получи текущие данные из таблицы
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${GOOGLE_SHEETS_API_KEY}`
    
    const getRes = await fetch(getUrl)
    if (!getRes.ok) {
      throw new Error(`Google Sheets API error: ${getRes.statusText}`)
    }
    
    const getData = await getRes.json()
    const rows = getData.values || []

    console.log("📋 Filas encontradas en Google Sheets:", rows.length)

    // 2️⃣ Найди строку с товаром и размером
    let targetRowIndex = -1
    let currentStock = 0

    for (let i = 1; i < rows.length; i++) { // Пропусти заголовок
      const row = rows[i]
      if (row[0] === productId.toString() && row[2] === size) {
        targetRowIndex = i
        currentStock = parseInt(row[4]) || 0 // Столбец "Cantidad" (E)
        console.log(`✅ Encontrado producto en fila ${i + 1}`)
        break
      }
    }

    if (targetRowIndex === -1) {
      console.warn(`⚠️ Producto ${productId} (${size}) no encontrado en Google Sheets`)
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          error: "Product not found in inventory",
          productId,
          size
        })
      }
    }

    // 3️⃣ Вычисли новый сток
    const newStock = Math.max(0, currentStock - quantityDecrement)
    
    // 4️⃣ Обнови таблицу
    const updateRange = `Stock!E${targetRowIndex + 1} // +1 потому что индексы от 0`
    
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${updateRange}?valueInputOption=USER_ENTERED&key=${GOOGLE_SHEETS_API_KEY}`
    
    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [[newStock]]
      })
    })

    if (!updateRes.ok) {
      throw new Error(`Google Sheets update error: ${updateRes.statusText}`)
    }

    const updateData = await updateRes.json()

    // 5️⃣ Обнови дату последнего обновления
    const lastUpdateRange = `Stock!F${targetRowIndex + 1} // Столбец "Última Actualización"`
    const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const dateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${lastUpdateRange}?valueInputOption=USER_ENTERED&key=${GOOGLE_SHEETS_API_KEY}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[now]] })
      }
    )

    if (!dateRes.ok) {
      console.warn("⚠️ No se pudo actualizar la fecha de última actualización")
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
      body: JSON.stringify({
        error: error.message || "Error al actualizar el stock",
        details: error.toString()
      })
    }
  }
}