const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"

export default async (req) => {
  const url = `${STRAPI}/api/promo-bars`
    // ВАЖНО: fields — белый список. Всё, чего здесь нет, на фронт не приедет.
    + `?fields[0]=text`
    + `&fields[1]=text_en`
    + `&fields[2]=background_color`
    + `&fields[3]=opacity`
    + `&fields[4]=light_text`
    + `&fields[5]=is_active`
    // Записей может быть технически несколько (collection type),
    // но на фронте используем только первую — берём максимум одну сразу здесь
    + `&pagination[limit]=1`

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
      "Netlify-Cache-Tag": "promo-bar"
    }
  })
}