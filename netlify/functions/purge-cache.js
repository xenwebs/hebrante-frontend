import { purgeCache } from "@netlify/functions"

export default async () => {
  try {
    await purgeCache({ tags: ["products", "banners"] })
    return new Response("Cache purged", { status: 202 })
  } catch (e) {
    return new Response("Purge failed: " + e.message, { status: 500 })
  }
}