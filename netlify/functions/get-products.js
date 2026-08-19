const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"
const PAGE_SIZE = 100

// 🔧 Поля, по которым можно управлять порядком вручную (Strapi → Product).
// banner_order  — приоритет товара ВНУТРИ подборки под конкретным баннером
// catalog_order — приоритет товара на странице "Все товары"
// Оба поля необязательные (Integer, allow null). Если не заполнены —
// товар просто остаётся в исходном порядке, никак не мешая другим.
const ORDER_FIELD_BY_CONTEXT = {
  banner: "banner_order",
  catalog: "catalog_order"
}

/**
 * Сортирует товары по указанному полю приоритета.
 * - товары с заполненным числовым значением идут первыми, по возрастанию
 * - товары без значения (null/undefined) остаются в исходном порядке
 *   и добавляются в конец списка
 * Так можно проставить приоритет только первым 6–9 товарам,
 * не трогая остальные 50+.
 */
function applyManualOrder(products, field) {
  const withOrder = []
  const withoutOrder = []

  products.forEach((item, index) => {
    const value = item[field]
    if (Number.isFinite(value)) {
      withOrder.push({ item, value, index })
    } else {
      withoutOrder.push(item)
    }
  })

  withOrder.sort((a, b) => (a.value - b.value) || (a.index - b.index))

  return [...withOrder.map(o => o.item), ...withoutOrder]
}

export default async (req) => {
  const url = new URL(req.url)
  const collection = url.searchParams.get("collection")
  const context = url.searchParams.get("context") // "banner" | "catalog" | null

  // Базовые параметры, общие для всех страниц пагинации
  const baseParams = new URLSearchParams()
  baseParams.set("populate", "*")
  baseParams.set("pagination[pageSize]", String(PAGE_SIZE))
  if (collection) {
    baseParams.set("filters[collection][slug][$eq]", collection)
  }

  const all = []
  let page = 1
  let pageCount = 1

  try {
    do {
      const params = new URLSearchParams(baseParams)
      params.set("pagination[page]", String(page))

      const res = await fetch(`${STRAPI}/api/products?${params}`)
      if (!res.ok) {
        return new Response(JSON.stringify({ error: res.status }), { status: res.status })
      }

      const json = await res.json()
      all.push(...(json.data || []))

      // Strapi сам говорит, сколько всего страниц — доверяем ему, а не гадаем
      pageCount = json.meta?.pagination?.pageCount ?? 1
      page++
    } while (page <= pageCount)
  } catch (error) {
    return new Response(JSON.stringify({ error: "fetch_failed" }), { status: 502 })
  }

  // ✅ Ручная сортировка по banner_order / catalog_order, если контекст передан.
  // Без context (например, обычные страницы коллекций) — порядок не трогаем,
  // отдаём как пришло из Strapi.
  const orderField = ORDER_FIELD_BY_CONTEXT[context]
  const data = orderField ? applyManualOrder(all, orderField) : all

  return new Response(JSON.stringify({ data, meta: { total: data.length } }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Netlify-Cache-Tag": "products",
      // context тоже влияет на порядок в ответе — CDN должен кэшировать
      // варианты с разным context отдельно друг от друга
      "Netlify-Vary": "query=collection,context"
    }
  })
}