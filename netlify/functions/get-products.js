const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"
const PAGE_SIZE = 100

export default async (req) => {
  const collection = new URL(req.url).searchParams.get("collection")

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

  return new Response(JSON.stringify({ data: all, meta: { total: all.length } }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Netlify-Cache-Tag": "products",
      "Netlify-Vary": "query=collection"
    }
  })
}