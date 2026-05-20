// netlify/functions/check-stock.js
// Проверяет наличие товара в Google Sheets перед добавлением в корзину

const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID
const SHEET_NAME = "INVENTARIOS"
const SIZES = ['xxs', 'xs', 's', 'm', 'l', 'xl']

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    }
  }

  try {
    const { productId, size } = JSON.parse(event.body)

    if (!productId || !size) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "productId and size are required",
          received: { productId, size }
        })
      }
    }

    console.log(`🔍 Verificando stock para: Producto ${productId}, Talla ${size.toUpperCase()}`)

    // 1️⃣ Получи данные из Google Sheets
    const sheetData = await readGoogleSheet()
    
    // 2️⃣ Найди товар по ID
    const product = findProductInSheet(sheetData, productId)
    
    if (!product) {
      console.warn(`⚠️ Producto ${productId} no encontrado en Google Sheets`)
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: `Producto ${productId} no encontrado en el inventario`,
          available: false,
          stock: 0
        })
      }
    }

    // 3️⃣ Получи сток для конкретного размера
    const sizeKey = size.toLowerCase()
    const stock = product.stock[sizeKey] || 0

    console.log(`📦 ${product.name} (${size.toUpperCase()}): ${stock} disponibles`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        productId: productId,
        productName: product.name,
        size: size.toUpperCase(),
        stock: stock,
        available: stock > 0,
        message: stock > 0 ? "Stock disponible" : "Producto agotado"
      })
    }

  } catch (error) {
    console.error("❌ Error en check-stock:", error)
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error verificando stock",
        details: error.message
      })
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

async function readGoogleSheet() {
  try {
    // Rango: Columna B (ID) hasta W (XL), filas 7 a 350
    // Esto cubre: ID, Nombre, Precio y Stock (XXS-XL)
    const range = `${SHEET_NAME}!A:W`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_SHEETS_API_KEY}`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.values || []

  } catch (error) {
    console.error("❌ Error leyendo Google Sheets:", error)
    throw error
  }
}

function findProductInSheet(sheetData, productId) {
  // Estructura de la tabla:
  // Fila 0: Encabezados
  // Columna A (0): Nombre
  // Columna B (1): ID
  // Columna C (2): Precio
  // Columna R-W (17-22): Stock XXS-XL
  
  // Filas empiezan en 7 (DATA_START_ROW)
  const DATA_START_ROW = 6 // índice 0 = fila 1

  for (let i = DATA_START_ROW; i < sheetData.length; i++) {
    const row = sheetData[i]
    
    if (!row || !row[1]) continue // Saltar filas vacías

    const rowProductId = parseInt(row[1]) // Columna B = ID
    
    if (rowProductId === parseInt(productId)) {
      const productName = row[0]?.toString().trim() // Columna A = Nombre
      
      // Extraer stock por tamaños
      // Columnas R-W = índices 17-22 (en base 0)
      const stock = {}
      SIZES.forEach((size, index) => {
        const stockValue = row[17 + index] || 0 // Empezar desde columna R
        stock[size] = parseInt(stockValue) || 0
      })

      console.log(`✅ Producto encontrado: ${productName}`)
      console.log(`   Stock: XXS=${stock.xxs}, XS=${stock.xs}, S=${stock.s}, M=${stock.m}, L=${stock.l}, XL=${stock.xl}`)

      return {
        name: productName,
        id: rowProductId,
        stock: stock,
        rowIndex: i
      }
    }
  }

  return null
}