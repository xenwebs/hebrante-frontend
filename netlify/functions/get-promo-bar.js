const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"

export default async (req) => {
  const url = `${STRAPI}/api/promo-bars`
    // ВАЖНО: fields — белый список. Всё, чего здесь нет, на фронт не приедет.
    // 4 слота текста (text — обязательный, text_2/3/4 — опциональные),
    // у каждого есть англоязычная пара для мультиязычности.
    + `?fields[0]=text`
    + `&fields[1]=text_en`
    + `&fields[2]=text_2`
    + `&fields[3]=text_2_en`
    + `&fields[4]=text_3`
    + `&fields[5]=text_3_en`
    + `&fields[6]=text_4`
    + `&fields[7]=text_4_en`
    + `&fields[8]=background_color`
    + `&fields[9]=opacity`
    + `&fields[10]=light_text`
    + `&fields[11]=is_active`
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