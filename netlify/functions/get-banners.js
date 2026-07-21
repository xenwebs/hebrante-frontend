const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"

export default async (req) => {
  const url = `${STRAPI}/api/banners`
    + `?sort=order:asc`
    + `&fields[0]=slug&fields[1]=title`
    + `&populate[image][fields][0]=url`
    + `&populate[collection][fields][0]=slug`

  const res = await fetch(url)
  if (!res.ok) {
    // Ошибки НЕ кэшируем — возвращаем без cache-заголовков
    return new Response(JSON.stringify({ error: res.status }), { status: res.status })
  }
  const data = await res.json()

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      // Браузер сам ничего не кэширует — всегда спрашивает у CDN (ответ приходит из durable-кэша за ~40-70мс)
      "Cache-Control": "public, max-age=0, must-revalidate",
      // durable = общий кэш для всех edge-узлов (не per-POP)
      // s-maxage=1 год = живёт до тех пор, пока purge-cache.js не сбросит его по вебхуку Strapi
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=31536000, must-revalidate",
      "Netlify-Cache-Tag": "banners"
    }
  })
}