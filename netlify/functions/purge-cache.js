import { purgeCache } from "@netlify/functions"

export default async () => {
  await purgeCache({ tags: ["products", "banners"] })
  return new Response("Cache purged", { status: 202 })
}