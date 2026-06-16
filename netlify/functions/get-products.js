const STRAPI = "https://proper-gem-a18dd78c57.strapiapp.com"

export default async (req) => {
  const url = `${STRAPI}/api/banners?populate=*&sort=order:asc`

  const res = await fetch(url)
  if (!res.ok) {
    return new Response(JSON.stringify({ error: res.status }), { status: res.status })
  }
  const data = await res.json()

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Netlify-Cache-Tag": "banners"
    }
  })
}