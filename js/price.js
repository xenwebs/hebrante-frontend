// js/price.js
// Единый источник правды для расчёта и форматирования цен со скидкой.

const COP = new Intl.NumberFormat("es-CO")

// Округление финальной цены до "красивого" значения.
// 100 = до ближайшей сотни песо. Поставь 1, чтобы отключить округление.
const PRICE_ROUND_STEP = 100

// Есть ли действующая скидка? (0 и 100 намеренно не считаются скидкой)
export function hasDiscount(product) {
  const p = Number(product?.discount_percent || 0)
  return p > 0 && p < 100
}

// Финальная цена с учётом скидки и округления
export function getFinalPrice(product) {
  const base = Number(product?.price || 0)
  if (!hasDiscount(product)) return base

  const percent = Number(product.discount_percent)
  const discounted = base * (1 - percent / 100)
  return Math.round(discounted / PRICE_ROUND_STEP) * PRICE_ROUND_STEP
}

// Готовый объект для рендера: всё, что нужно шаблону
export function getPriceView(product) {
  const base = Number(product?.price || 0)
  const final = getFinalPrice(product)
  const discounted = hasDiscount(product)

  return {
    discounted,                                   // true/false
    percent: discounted ? Number(product.discount_percent) : 0,
    base,
    final,
    baseFormatted: COP.format(base),              // старая цена
    finalFormatted: COP.format(final),            // новая цена
  }
}