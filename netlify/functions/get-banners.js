const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"

export default async (req) => {
  const url = `${STRAPI}/api/banners`
    + `?sort=order:asc`
    // ВАЖНО: fields — это белый список для полей САМОГО Banner (не компонентов).
    // `order` нужен фронту для сортировки, `split` — чтобы понять, рендерить
    // баннер одним слотом или двумя половинами.
    + `&fields[0]=slug&fields[1]=order&fields[2]=split`

    // ---- content (обязательный слот — единственный слот, либо левая/верхняя половина) ----
    + `&populate[content][populate][image][fields][0]=url`
    + `&populate[content][populate][image_mobile][fields][0]=url`
    + `&populate[content][populate][collection][fields][0]=slug`
    // Ручная привязка конкретных продуктов к слоту (альтернатива collection).
    // Поля продублированы под формат, который ждёт renderManualProducts в banners.js —
    // те же поля, что отдаёт get-products.js, чтобы фронт не делал лишний запрос.
    + `&populate[content][populate][products][fields][0]=title`
    + `&populate[content][populate][products][fields][1]=title_en`
    + `&populate[content][populate][products][fields][2]=slug`
    + `&populate[content][populate][products][fields][3]=price`
    + `&populate[content][populate][products][fields][4]=discount_percent`
    // Тут без fields — с ними глубина вложенности превышает лимит парсинга
    // query-строки в Strapi (получаем "Invalid key ..."), а объекты и так небольшие.
    + `&populate[content][populate][products][populate][images]=true`
    + `&populate[content][populate][products][populate][collection]=true`
    // Скалярные поля компонента (eyebrow/eyebrow_en/heading/heading_en/subheading/
    // subheading_en/light_text/button_text/button_text_en/button_bg_color/
    // button_text_color) приходят автоматически при populate компонента —
    // отдельный fields-список под них не нужен.

    // ---- content_2 (необязательный слот — вторая половина при split=true) ----
    + `&populate[content_2][populate][image][fields][0]=url`
    + `&populate[content_2][populate][image_mobile][fields][0]=url`
    + `&populate[content_2][populate][collection][fields][0]=slug`
    + `&populate[content_2][populate][products][fields][0]=title`
    + `&populate[content_2][populate][products][fields][1]=title_en`
    + `&populate[content_2][populate][products][fields][2]=slug`
    + `&populate[content_2][populate][products][fields][3]=price`
    + `&populate[content_2][populate][products][fields][4]=discount_percent`
    + `&populate[content_2][populate][products][populate][images]=true`
    + `&populate[content_2][populate][products][populate][collection]=true`

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