// netlify/functions/create-shipment.js
//
// Crea un envío en Envia.com (Deprisa) para un pedido YA PAGADO.
// Se llama DESPUÉS de confirmar el pago, igual que send-order-email.
// El token vive SOLO aquí (en el servidor), nunca en el navegador.

// ==================== CONFIGURACIÓN ====================

// 🔑 Token de Envia.
// Configúralo en Netlify → Site settings → Environment variables (ENVIA_TOKEN).
const ENVIA_TOKEN = process.env.ENVIA_TOKEN

// 🧪 Sandbox por defecto. Para producción real pon ENVIA_ENV=production en Netlify.
const ENVIA_BASE =
  process.env.ENVIA_ENV === 'production'
    ? 'https://api.envia.com'
    : 'https://api-test.envia.com'

// 🚚 Transportadora. Se puede cambiar sin tocar el código (variable de entorno).
const ENVIA_CARRIER = process.env.ENVIA_CARRIER || 'deprisa'

// Servicio opcional. Si lo dejas vacío, pedimos tarifas y usamos el primero disponible.
const ENVIA_SERVICE = process.env.ENVIA_SERVICE || ''

// Strapi: usamos las mismas variables que bold-webhook.js
const STRAPI_URL = process.env.STRAPI_URL || 'https://proper-gem-a18dd78c57.strapiapp.com'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

// Cabeceras para Strapi (añade el token solo si está configurado)
const strapiHeaders = (extra = {}) =>
  STRAPI_API_TOKEN
    ? { ...extra, Authorization: `Bearer ${STRAPI_API_TOKEN}` }
    : { ...extra }

// 📦 DIRECCIÓN DE ORIGEN (bodega / tienda que envía).
// ⚠️ REEMPLAZA con los datos reales cuando el cliente los confirme.
//    Lo más limpio es ponerlos como variables de entorno en Netlify.
const ORIGIN = {
  name: process.env.ENVIA_ORIGIN_NAME || 'HEBRANTE',
  phone: process.env.ENVIA_ORIGIN_PHONE || '+57 3000000000',
  street: process.env.ENVIA_ORIGIN_STREET || 'REEMPLAZAR DIRECCIÓN BODEGA',
  city: process.env.ENVIA_ORIGIN_CITY || 'Bogotá',
  state: process.env.ENVIA_ORIGIN_STATE || 'Cundinamarca',
  country: 'CO',
  postalCode: process.env.ENVIA_ORIGIN_ZIP || '110111'
}

// 📦 PAQUETE POR DEFECTO.
// El pedido no guarda peso ni medidas, así que usamos un paquete estándar.
// ⚠️ Ajusta a los valores reales de tus envíos de ropa.
const DEFAULT_PACKAGE = {
  type: 'box',
  content: 'Ropa',
  amount: 1,
  lengthUnit: 'CM',
  weightUnit: 'KG',
  weight: Number(process.env.ENVIA_PACKAGE_WEIGHT || 1),
  dimensions: {
    length: Number(process.env.ENVIA_PACKAGE_LENGTH || 30),
    width: Number(process.env.ENVIA_PACKAGE_WIDTH || 25),
    height: Number(process.env.ENVIA_PACKAGE_HEIGHT || 10)
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // --- DIAGNÓSTICO (quitar cuando funcione) ---
  console.log('🔑 ENVIA_TOKEN presente:', !!ENVIA_TOKEN, '| largo:', (ENVIA_TOKEN || '').length)
  console.log(
    '🔧 Vars ENVIA visibles:',
    Object.keys(process.env).filter(k => k.startsWith('ENVIA')).join(', ') || 'NINGUNA'
  )
  // --------------------------------------------

  if (!ENVIA_TOKEN) {
    console.error('❌ Falta ENVIA_TOKEN en las variables de entorno')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ENVIA_TOKEN no configurado' })
    }
  }

  try {
    const { orderId } = JSON.parse(event.body)
    console.log('📦 Creando envío para ORDER ID:', orderId)

    // 1️⃣ Traer el pedido desde Strapi (igual que send-order-email)
    const orderRes = await fetch(`${STRAPI_URL}/api/orders/${orderId}`, {
      headers: strapiHeaders()
    })
    const orderData = await orderRes.json()
    const order = orderData.data

    if (!order) {
      throw new Error(`Pedido ${orderId} no encontrado en Strapi`)
    }

    // 2️⃣ Dirección de destino con los datos del comprador
    const destination = {
      name: `${order.firstName} ${order.lastName}`.trim(),
      phone: order.phone || '',
      street: [order.street, order.apartment].filter(Boolean).join(' '),
      city: order.city,
      state: order.state,
      country: 'CO',
      postalCode: String(order.zip || '')
    }

    // 3️⃣ Paquete (valor declarado = subtotal del pedido)
    const pkg = {
      ...DEFAULT_PACKAGE,
      declaredValue: Number(order.subtotal || order.total || 0)
    }

    const baseBody = {
      origin: ORIGIN,
      destination,
      packages: [pkg],
      settings: { currency: 'COP' }
    }

    // 4️⃣ Determinar el servicio de la transportadora
    let service = ENVIA_SERVICE

    if (!service) {
      // Pedimos tarifas para descubrir el servicio disponible de Deprisa
      console.log('🔄 Pidiendo tarifas a Envia...')
      const rateRes = await fetch(`${ENVIA_BASE}/ship/rate/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENVIA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...baseBody,
          shipment: { type: 1, carrier: ENVIA_CARRIER }
        })
      })

      const rateData = await rateRes.json()
      console.log('📋 Tarifas:', JSON.stringify(rateData))

      const firstRate = Array.isArray(rateData.data) ? rateData.data[0] : null
      if (!firstRate || !firstRate.service) {
        throw new Error('Envia no devolvió servicios disponibles para esta ruta')
      }
      service = firstRate.service
      console.log('✅ Servicio elegido:', service)
    }

    // 5️⃣ Generar la guía (etiqueta) — ESTO crea el envío real
    console.log('🔄 Generando guía con Envia...')
    const genRes = await fetch(`${ENVIA_BASE}/ship/generate/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENVIA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...baseBody,
        shipment: { type: 1, carrier: ENVIA_CARRIER, service }
      })
    })

    const genData = await genRes.json()
    console.log('📋 Respuesta de generación:', JSON.stringify(genData))

    const shipment = Array.isArray(genData.data) ? genData.data[0] : null
    if (!shipment || !shipment.trackingNumber) {
      throw new Error(genData.error || 'Envia no devolvió número de guía')
    }

    const result = {
      trackingNumber: shipment.trackingNumber,
      labelUrl: shipment.label,
      trackUrl: shipment.trackUrl,
      carrier: shipment.carrier,
      service: shipment.service
    }

    console.log('✅ Envío creado:', result)

    // 6️⃣ Guardar la guía en el pedido de Strapi (opcional pero recomendado).
    // ⚠️ Requiere que el content-type "order" tenga estos campos (tipo text):
    //    trackingNumber, labelUrl, shippingCarrier
    //    Si aún no existen, este paso falla en silencio y el envío igual se crea.
    try {
      await fetch(`${STRAPI_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: strapiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          data: {
            trackingNumber: result.trackingNumber,
            labelUrl: result.labelUrl || '',
            shippingCarrier: result.carrier || ENVIA_CARRIER
          }
        })
      })
      console.log('✅ Guía guardada en el pedido de Strapi')
    } catch (e) {
      console.warn('⚠️ No se pudo guardar la guía en Strapi:', e.message)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, ...result })
    }

  } catch (error) {
    console.error('❌ ERROR:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}