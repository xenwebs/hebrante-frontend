import { waitForVideosReady, initVideoAutoplay } from "./media-ready.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

async function loadWorkshopVideos() {
  const preloader = window.globalPreloader

  if (preloader) preloader.minShowDuration = 250

  const container = document.querySelector(".workshop__block")

  try {
    const response = await fetch(
      `${API_URL}/api/workshop-pages?populate=*`
    )

    const data = await response.json()
    const page = data.data?.[0]

    if (!page) {
      console.log("❌ Нет записей workshop-pages")
      return
    }

    // Strapi v5-safe
    const videos = page.videos || page.attributes?.videos

    if (!container) {
      console.log("❌ workshop container not found")
      return
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      console.log("❌ Нет видео в workshop")
      return
    }

    container.innerHTML = videos
      .filter(video => video.url)
      .map(video => `
        <div class="video-wrapper">
          <video
            class="video"
            muted
            loop
            playsinline
            preload="metadata"
            autoplay
          >
            <source src="${video.url}" type="video/mp4">
          </video>
        </div>
      `)
      .join("")

    await waitForVideosReady(container)

    initVideoAutoplay(container)

    console.log("✅ Workshop videos loaded")

  } catch (error) {
    console.error("❌ Error loading workshop videos:", error)
  } finally {
    preloader?.hide(0)
  }
}

loadWorkshopVideos()