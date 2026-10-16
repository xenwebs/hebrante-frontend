// netlify/functions/lib/promo.js
//
// Общая серверная логика промокодов для validate-promo.js и generate-hash.js.
// Strapi читаем серверным токеном STRAPI_API_TOKEN (тип Read-only), поэтому
// публичный доступ к коллекции promo-codes в Strapi больше не нужен.
//
// Сколько раз код уже использован — считаем не счётчиком, а по самим заказам:
// это оплаченные (orderStatus = "paid") заказы с таким promoCode. Статус "paid"
// ставит вебхук Bold, поэтому отдельный счётчик и его синхронизация не нужны,
// а повторная доставка вебхука ничего не ломает.
//
// Лимит задаёт поле max_uses в promo-code: пусто = без ограничений, 1 = одноразовый.

const STRAPI_URL = (process.env.STRAPI_URL || "https://proper-gem-a18dd78c57.strapiapp.com").replace(/\/+$/, "")
const STRAPI_TOKEN = (process.env.STRAPI_API_TOKEN || "").trim()

// Допустимые символы кода (после trim + toUpperCase)
const CODE_PATTERN = /^[A-Z0-9_-]{1,40}$/

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }
}

// GET в Strapi с токеном и таймаутом. 404 → null, любая другая ошибка → throw
// (проверки промокода «падают закрытыми»: если Strapi недоступен, код не применяется).
export async function strapiGet(path, ms = 8000) {
  if (!STRAPI_TOKEN) throw new Error("STRAPI_API_TOKEN no está configurado")

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
      signal: ctrl.signal
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Strapi HTTP ${res.status} en ${path.split("?")[0]}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export function normalizeCode(raw) {
  const code = String(raw || "").trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

// Сегодняшняя дата в Боготе (YYYY-MM-DD). Раньше брали UTC-дату, из-за чего
// код с valid_until «сегодня» переставал работать в 19:00 по Боготе.
function todayInBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

export function subtotalOf(items) {
  return items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  )
}

// Та же формула, что calculateDiscount в checkout.js
export function calculateDiscount(items, percent, applicableIds) {
  if (!percent) return 0

  const eligible = applicableIds
    ? items.filter(item => applicableIds.includes(item.id))
    : items

  return Math.round(subtotalOf(eligible) * (percent / 100))
}

// Сколько оплаченных заказов уже использовали этот код
export async function countPaidUses(code) {
  const q = new URLSearchParams()
  q.set("filters[promoCode][$eqi]", code)
  q.set("filters[orderStatus][$eq]", "paid")
  q.set("pagination[pageSize]", "1")
  q.set("pagination[withCount]", "true")

  const data = await strapiGet(`/orders?${q}`)
  const total = data?.meta?.pagination?.total
  if (typeof total !== "number") {
    throw new Error("Strapi no devolvió el total de pedidos")
  }
  return total
}

// Ищет код и проверяет всё, что не зависит от корзины:
// активность, даты, лимит использований.
// Возвращает { promo } или { error: "invalid" | "not_started" | "expired" | "exhausted" }
export async function loadValidPromo(rawCode) {
  const code = normalizeCode(rawCode)
  if (!code) return { error: "invalid" }

  const q = new URLSearchParams()
  q.set("filters[code][$eqi]", code)
  q.set("filters[is_active][$eq]", "true")
  q.set("populate", "applicable_products")

  const data = await strapiGet(`/promo-codes?${q}`)
  const entry = (data?.data || []).find(
    p => String(p.code || "").toUpperCase() === code
  )
  if (!entry) return { error: "invalid" }

  const today = todayInBogota()
  if (entry.valid_from && entry.valid_from > today) return { error: "not_started" }
  if (entry.valid_until && entry.valid_until < today) return { error: "expired" }

  // Лимит использований: max_uses пусто → без ограничений
  const maxUses = entry.max_uses == null ? null : Number(entry.max_uses)
  if (maxUses !== null && Number.isFinite(maxUses)) {
    const used = await countPaidUses(code)
    if (used >= maxUses) return { error: "exhausted" }
  }

  // Применимые товары (пусто → весь заказ). Поддерживаем и плоский формат
  // Strapi v5, и обёрнутый { data: [...] }. В корзине item.id = slug товара.
  const raw = entry.applicable_products
  const related = Array.isArray(raw)
    ? raw
    : (raw && Array.isArray(raw.data) ? raw.data : [])
  const applicableIds = related.length > 0 ? related.map(p => p.slug || p.id) : null

  return {
    promo: {
      code: entry.code,
      discountPercent: Number(entry.discount_percent) || 0,
      minPurchase: Number(entry.min_purchase_amount) || 0,
      applicableIds
    }
  }
}