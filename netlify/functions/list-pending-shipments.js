// netlify/functions/list-pending-shipments.js
//
// Devuelve los pedidos PAGADOS que todavía no tienen guía de Envia generada.
// Usado por el panel /admin/envios.html para mostrar qué falta confirmar.

const STRAPI_URL = process.env.STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN
const SHIPPING_ADMIN_PASSWORD = process.env.SHIPPING_ADMIN_PASSWORD || ''

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!SHIPPING_ADMIN_PASSWORD) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SHIPPING_ADMIN_PASSWORD no configurado' }) }
  }

  const providedPassword = event.headers['x-admin-password'] || ''
  if (providedPassword !== SHIPPING_ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) }
  }

  try {
    // Pedidos pagados, sin trackingNumber todavía.
    // ⚠️ Filtra por trackingNumber vacío (no por shippingStatus) para que funcione
    //    AUNQUE todavía no hayas creado el campo shippingStatus en Strapi.
    const url =
      `${STRAPI_URL}/api/orders?` +
      `filters[orderStatus][$eq]=paid&` +
      `filters[trackingNumber][$null]=true&` +
      `sort=paidAt:desc&` +
      `pagination[pageSize]=100`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
    })

    if (!res.ok) {
      throw new Error(`Strapi respondió ${res.status}`)
    }

    const json = await res.json()
    const orders = Array.isArray(json?.data) ? json.data : []

    const simplified = orders.map(o => ({
      id: o.documentId || o.id,
      orderRef: o.orderRef || o.id,
      name: `${o.firstName || ''} ${o.lastName || ''}`.trim(),
      city: o.city || '',
      total: o.total || o.subtotal || 0,
      paidAt: o.paidAt || o.createdAt,
      items: Array.isArray(o.items) ? o.items.map(i => `${i.title || ''} x${i.quantity || 1}`) : []
    }))

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, orders: simplified })
    }
  } catch (error) {
    console.error('❌ ERROR list-pending-shipments:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}