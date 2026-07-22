// netlify/functions/create-shipment.js
//
// Crea un envío en Envia.com para un pedido YA PAGADO.
// Se llama DESPUÉS de confirmar el pago, igual que send-order-email.
// El token vive SOLO aquí (en el servidor), nunca en el navegador.
//
// 🆕 SELECCIÓN AUTOMÁTICA DE TRANSPORTADORA:
//    Envia NO permite crear un envío "sin transportadora" para elegirla luego
//    en el panel: /ship/generate exige carrier + service y genera la guía al
//    instante. Además /ship/rate TAMBIÉN exige `carrier` (aunque la
//    documentación lo describa como filtro opcional).
//
//    Por eso, para comparar precios: se consulta la lista de transportadoras
//    activas del país y se cotiza CADA UNA en paralelo. De todas las tarifas
//    recibidas se elige la mejor según el criterio configurado.

// ==================== CONFIGURACIÓN ====================

// 🔑 Token de Envia.
// Configúralo en Netlify → Site settings → Environment variables (ENVIA_TOKEN).
const ENVIA_TOKEN = process.env.ENVIA_TOKEN

// 🧪 Sandbox por defecto. Para producción real pon ENVIA_ENV=production en Netlify.
const IS_PRODUCTION = process.env.ENVIA_ENV === 'production'

const ENVIA_BASE = IS_PRODUCTION
  ? 'https://api.envia.com'
  : 'https://api-test.envia.com'

// Queries API: catálogo de transportadoras activas por país.
const QUERIES_BASE = IS_PRODUCTION
  ? 'https://queries.envia.com'
  : 'https://queries-test.envia.com'

const COUNTRY = 'CO'

// 🎯 Criterio de selección: 'cheapest' (más barata) | 'fastest' (más rápida).
const ENVIA_SELECTION = (process.env.ENVIA_SELECTION || 'cheapest').toLowerCase()

// 🚚 Lista fija de transportadoras a cotizar (separadas por comas).
//    Si se deja vacía, se consultan automáticamente las activas del país.
//    Ej: ENVIA_CARRIERS="coordinadora,serviEntrega,interRapidisimo,tcc"
const CARRIERS_OVERRIDE = (process.env.ENVIA_CARRIERS || '')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean)

// 🚫 Transportadoras que NO se quieren usar nunca (separadas por comas).
//    Ej: ENVIA_EXCLUDE_CARRIERS="dhl,fedex"  (las internacionales suelen ser caras)
const EXCLUDED_CARRIERS = (process.env.ENVIA_EXCLUDE_CARRIERS || '')
  .split(',')
  .map(c => c.trim().toLowerCase())
  .filter(Boolean)

// 📌 Forzar una transportadora y servicio concretos (opcional).
//    Si se definen AMBOS, no se cotiza nada y se usa esa combinación tal cual.
//    ⚠️ 'deprisa' NO existe en Envia Colombia — era la causa del error 1125.
const ENVIA_CARRIER = process.env.ENVIA_CARRIER || ''
const ENVIA_SERVICE = process.env.ENVIA_SERVICE || ''

// ⏱️ Tiempo máximo por cotización. Si una transportadora tarda más, se descarta
//    y se sigue con las demás (el webhook de Bold no puede esperar eternamente).
const RATE_TIMEOUT_MS = Number(process.env.ENVIA_RATE_TIMEOUT_MS || 6000)

// 🖨️ Formato/tamaño de la etiqueta (lo exige /ship/generate).
//    printFormat: PDF | PNG | ZPL    | printSize: STOCK_4X6 (térmica) | PAPER_7X4.75 (hoja)
const ENVIA_PRINT_FORMAT = process.env.ENVIA_PRINT_FORMAT || 'PDF'
const ENVIA_PRINT_SIZE = process.env.ENVIA_PRINT_SIZE || 'STOCK_4X6'

// 🌎 Geocodes API: resuelve ciudad / código de estado.
// Envia recomienda validar antes de cotizar; para Colombia el estado va como
// CÓDIGO corto (no el nombre) y city/postalCode como Código DANE.
const GEOCODES_BASE = 'https://geocodes.envia.com'

// fetch con timeout, para que una transportadora lenta no cuelgue todo el proceso.
async function fetchWithTimeout(url, options = {}, ms = RATE_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// Llama a una URL del Geocodes API y normaliza la primera coincidencia.
async function geocodeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ENVIA_TOKEN}` }
    })
    const json = await res.json()

    // La respuesta puede ser un array directo o venir bajo .data
    const arr = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : [])
    const g = arr[0]
    if (!g) return null

    // Código CORTO del estado (Colombia: "DC", etc.)
    const state =
      g.state?.code?.['2digit'] ||
      g.state?.code?.['3digit'] ||
      (g.state?.iso_code || '').replace(/^CO-/, '') ||
      g.state?.name

    // El DANE puede venir directo (/zipcode) o anidado en zip_codes[0] (/locate).
    const firstZc = Array.isArray(g.zip_codes) ? g.zip_codes[0] : null
    const dane =
      g.info?.stat_8digit ||
      (Array.isArray(g.suburbs) ? g.suburbs[0] : null) ||
      firstZc?.info?.stat_8digit ||
      g.info?.stat ||
      firstZc?.info?.stat ||
      g.zip_code ||
      firstZc?.zip_code ||
      g.zipcode ||
      null

    if (!state || !dane) return null
    return { state, city: dane, postalCode: dane }
  } catch (e) {
    console.warn('⚠️ Error en geocode', url, ':', e.message)
    return null
  }
}

// Resuelve un destino colombiano: primero por código postal; si el CP es inválido
// (los compradores suelen escribirlo mal), reintenta por NOMBRE DE CIUDAD.
async function resolveCO({ zip, city }) {
  if (zip) {
    const byZip = await geocodeFetch(`${GEOCODES_BASE}/zipcode/${COUNTRY}/${encodeURIComponent(zip)}`)
    if (byZip) return byZip
  }
  if (city) {
    const byCity = await geocodeFetch(`${GEOCODES_BASE}/locate/${COUNTRY}/${encodeURIComponent(city)}`)
    if (byCity) return byCity
  }
  return null
}

// Envia /ship/generate exige `street` y `number` por separado.
// En Colombia la dirección suele ser "Carrera 15 # 86B-09": separamos por el "#".
// Si no hay "#", dejamos la calle completa y usamos "SN" (sin número).
function splitCO(fullStreet) {
  const s = String(fullStreet || '').trim()
  const i = s.indexOf('#')
  if (i >= 0) {
    const street = s.slice(0, i).trim()
    const number = s.slice(i + 1).trim()
    return { street: street || s, number: number || 'SN' }
  }
  return { street: s, number: 'SN' }
}

// Las transportadoras rechazan el teléfono si no son 10 dígitos limpios
// (error "25 - TELEFONO ... INCORRECTO").
// Los compradores escriben "+57 300 000 0000", "(300) 000-0000", etc. → dejamos
// solo dígitos y quitamos el prefijo de país 57 si viene incluido.
function cleanCOPhone(raw) {
  let p = String(raw || '').replace(/\D/g, '') // solo dígitos
  if (p.length === 12 && p.startsWith('57')) p = p.slice(2) // 57XXXXXXXXXX → XXXXXXXXXX
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1)  // 0XXXXXXXXXX → XXXXXXXXXX
  return p
}

// Precio total de una tarifa (los nombres de campo varían según transportadora).
function ratePrice(rate) {
  const v = rate?.totalPrice ?? rate?.total_price ?? rate?.basePrice ?? rate?.base_price
  const n = Number(v)
  return Number.isFinite(n) ? n : Infinity
}

// Días estimados de entrega (para el criterio 'fastest').
function rateDays(rate) {
  const v = rate?.deliveryEstimate ?? rate?.delivery_estimate ?? rate?.deliveryDays
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : Infinity
}

// Lista de transportadoras activas del país (Queries API).
async function getAvailableCarriers() {
  if (CARRIERS_OVERRIDE.length) {
    console.log('📌 Transportadoras fijadas por configuración:', CARRIERS_OVERRIDE.join(', '))
    return CARRIERS_OVERRIDE
  }

  const res = await fetchWithTimeout(
    `${QUERIES_BASE}/carrier?country_code=${COUNTRY}`,
    { headers: { Authorization: `Bearer ${ENVIA_TOKEN}` } }
  )

  if (!res.ok) {
    throw new Error(`No se pudo obtener la lista de transportadoras: ${res.status}`)
  }

  const json = await res.json()
  const list = Array.isArray(json?.data) ? json.data : []

  return list
    .map(c => c?.name)
    .filter(Boolean)
    .filter(name => !EXCLUDED_CARRIERS.includes(String(name).toLowerCase()))
}

// Cotiza UNA transportadora. Devuelve un array de tarifas (vacío si falla).
// Nunca lanza: un fallo puntual no debe tumbar la comparación completa.
async function quoteCarrier(carrier, baseBody) {
  try {
    const res = await fetchWithTimeout(`${ENVIA_BASE}/ship/rate/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENVIA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...baseBody,
        shipment: { type: 1, carrier }
      })
    })

    const json = await res.json()

    if (json?.meta === 'error' || json?.error) {
      const msg = json.error?.message || JSON.stringify(json.error)
      console.log(`   ✖ ${carrier}: ${msg}`)
      return []
    }

    const rates = Array.isArray(json?.data) ? json.data : []
    if (!rates.length) {
      console.log(`   ✖ ${carrier}: sin tarifas para esta ruta`)
    }

    // Nos aseguramos de que cada tarifa lleve el carrier consultado.
    return rates.map(r => ({ ...r, carrier: r.carrier || carrier }))
  } catch (e) {
    const reason = e.name === 'AbortError' ? 'tiempo de espera agotado' : e.message
    console.log(`   ✖ ${carrier}: ${reason}`)
    return []
  }
}

// Elige la mejor tarifa de la lista según el criterio configurado.
function pickBestRate(rates) {
  const usable = rates.filter(r => {
    if (!r?.carrier || !r?.service) return false
    if (EXCLUDED_CARRIERS.includes(String(r.carrier).toLowerCase())) return false
    // Sin precio válido no se puede comparar ni confiar en la tarifa.
    return ratePrice(r) !== Infinity
  })

  if (!usable.length) return null

  const sorted = [...usable].sort((a, b) => {
    if (ENVIA_SELECTION === 'fastest') {
      const d = rateDays(a) - rateDays(b)
      if (d !== 0) return d
      return ratePrice(a) - ratePrice(b) // desempate por precio
    }
    const p = ratePrice(a) - ratePrice(b)
    if (p !== 0) return p
    return rateDays(a) - rateDays(b)     // desempate por rapidez
  })

  return sorted[0]
}

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
  country: COUNTRY,
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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

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
    console.log('🌐 Entorno Envia:', IS_PRODUCTION ? 'PRODUCCIÓN' : 'SANDBOX')

    // 1️⃣ Traer el pedido desde Strapi (igual que send-order-email)
    const orderRes = await fetch(`${STRAPI_URL}/api/orders/${orderId}`, {
      headers: strapiHeaders()
    })
    const orderData = await orderRes.json()
    const order = orderData.data

    if (!order) {
      throw new Error(`Pedido ${orderId} no encontrado en Strapi`)
    }

    // Evita generar (y pagar) una segunda guía si el webhook se reintenta.
    if (order.trackingNumber) {
      console.log('ℹ️ El pedido ya tiene guía:', order.trackingNumber)
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          alreadyExists: true,
          trackingNumber: order.trackingNumber
        })
      }
    }

    // 2️⃣ Resolver estado / ciudad con el Geocodes API (formato Colombia).
    //    Sobreescribe state (código corto) y city/postalCode con lo que devuelve Envia.
    const originGeo = await resolveCO({ zip: ORIGIN.postalCode, city: ORIGIN.city })
    const destGeo = await resolveCO({ zip: String(order.zip || ''), city: order.city })

    // Dirección de ORIGEN (bodega)
    const originSplit = splitCO(ORIGIN.street)
    const origin = {
      ...ORIGIN,
      phone: cleanCOPhone(ORIGIN.phone),
      street: originSplit.street,
      number: originSplit.number,
      state: originGeo?.state || ORIGIN.state,
      city: originGeo?.city || ORIGIN.city,
      postalCode: originGeo?.postalCode || ORIGIN.postalCode
    }

    // Dirección de DESTINO (comprador)
    const destSplit = splitCO(order.street)
    const destination = {
      name: `${order.firstName} ${order.lastName}`.trim(),
      phone: cleanCOPhone(order.phone),
      street: [destSplit.street, order.apartment].filter(Boolean).join(' '),
      number: destSplit.number,
      city: destGeo?.city || order.city,
      state: destGeo?.state || order.state,
      country: COUNTRY,
      postalCode: destGeo?.postalCode || String(order.zip || '')
    }

    console.log('📍 Destino resuelto:', destination.city, '/', destination.state)

    // 3️⃣ Paquete (valor declarado = subtotal del pedido)
    const pkg = {
      ...DEFAULT_PACKAGE,
      declaredValue: Number(order.subtotal || order.total || 0)
    }

    const baseBody = {
      origin,
      destination,
      packages: [pkg],
      settings: { currency: 'COP' }
    }

    // 4️⃣ Elegir transportadora y servicio
    let carrier = ENVIA_CARRIER
    let service = ENVIA_SERVICE

    if (carrier && service) {
      console.log(`📌 Transportadora fijada por configuración: ${carrier} / ${service}`)
    } else {
      // ⚠️ /ship/rate exige `carrier` obligatoriamente, así que no se puede pedir
      //    "todas las tarifas" en una sola llamada. Cotizamos cada transportadora
      //    por separado y en paralelo, y comparamos los resultados.
      const carriers = await getAvailableCarriers()

      if (!carriers.length) {
        throw new Error('No hay transportadoras disponibles para cotizar')
      }

      console.log(
        `🔄 Cotizando ${carriers.length} transportadoras (criterio: ${ENVIA_SELECTION}):`,
        carriers.join(', ')
      )

      const results = await Promise.all(
        carriers.map(c => quoteCarrier(c, baseBody))
      )
      const rates = results.flat()

      // Resumen legible de las opciones válidas
      rates.forEach(r => {
        console.log(`   • ${r.carrier} / ${r.service} — $${ratePrice(r)} COP — ${rateDays(r)} días`)
      })

      const best = pickBestRate(rates)
      if (!best) {
        throw new Error(
          `Ninguna de las ${carriers.length} transportadoras devolvió tarifas para esta ruta`
        )
      }

      carrier = best.carrier
      service = best.service
      console.log(
        `✅ Elegida: ${carrier} / ${service} — $${ratePrice(best)} COP — ${rateDays(best)} días`
      )
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
        // ⚠️ /ship/generate exige printFormat en settings (el /ship/rate NO lo pide).
        //    Por eso las tarifas pasaban y la generación fallaba con 400.
        settings: {
          ...baseBody.settings,
          printFormat: ENVIA_PRINT_FORMAT, // PDF por defecto
          printSize: ENVIA_PRINT_SIZE      // STOCK_4X6 (etiqueta térmica estándar)
        },
        shipment: { type: 1, carrier, service }
      })
    })

    const genData = await genRes.json()

    const shipment = Array.isArray(genData.data) ? genData.data[0] : null
    if (!shipment || !shipment.trackingNumber) {
      console.error('📋 Respuesta de generación:', JSON.stringify(genData))
      throw new Error(
        genData.error?.message || JSON.stringify(genData.error) || 'Envia no devolvió número de guía'
      )
    }

    const result = {
      trackingNumber: shipment.trackingNumber,
      labelUrl: shipment.label,
      trackUrl: shipment.trackUrl,
      carrier: shipment.carrier || carrier,
      service: shipment.service || service
    }

    console.log('✅ Envío creado:', result.carrier, result.trackingNumber)

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
            shippingCarrier: result.carrier || ''
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