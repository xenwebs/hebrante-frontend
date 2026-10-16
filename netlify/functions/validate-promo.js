// netlify/functions/validate-promo.js
//
// Проверка промокода при нажатии «Aplicar» на чекауте.
// Браузер присылает { code, cart }, функция читает Strapi серверным токеном
// и отвечает { valid: true, code, discountPercent, applicableIds }
// или { valid: false, error: "<код причины>" }.

import { json, loadValidPromo, subtotalOf } from "./lib/promo.js"

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch {
    return json(400, { error: "bad_request" })
  }

  const cart = Array.isArray(body.cart) ? body.cart.slice(0, 100) : []
  if (typeof body.code !== "string" || cart.length === 0) {
    return json(400, { error: "bad_request" })
  }

  try {
    const result = await loadValidPromo(body.code)
    if (!result.promo) {
      return json(200, { valid: false, error: result.error })
    }

    const { promo } = result

    if (promo.minPurchase && subtotalOf(cart) < promo.minPurchase) {
      return json(200, { valid: false, error: "min_purchase", minPurchase: promo.minPurchase })
    }

    if (promo.applicableIds && !cart.some(item => promo.applicableIds.includes(item.id))) {
      return json(200, { valid: false, error: "not_applicable" })
    }

    return json(200, {
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
      applicableIds: promo.applicableIds
    })
  } catch (error) {
    console.error("❌ validate-promo:", error.message)
    return json(500, { error: "server_error" })
  }
}