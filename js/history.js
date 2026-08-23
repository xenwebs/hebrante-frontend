import { waitForVideosReady, initVideoAutoplay } from "./media-ready.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

async function loadHistoryVideos() {
  const preloader = window.globalPreloader

  // раздел MARCA грузится быстро — не держим прелоадер лишнее время
  if (preloader) preloader.minShowDuration = 250

  const container = document.getElementById("history-videos")

  try {
    const response = await fetch(
      `${API_URL}/api/history-pages?populate=*`
    )

    const data = await response.json()
    const page = data.data?.[0]

    if (!page) {
      console.log("❌ Нет записей history-pages")
      return
    }

    // Strapi v5-safe
    const videos = page.videos || page.attributes?.videos

    if (!container) {
      console.log("❌ Container not found")
      return
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      console.log("❌ Нет видео в history")
      return
    }

    // один innerHTML вместо N appendChild = один reflow
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

    // ⚠️ ключевой момент: ждём размеры видео, чтобы лэйаут стал финальным
    await waitForVideosReady(container)

    initVideoAutoplay(container)

    console.log("✅ Videos loaded")

  } catch (error) {
    console.error("❌ Error loading videos:", error)
  } finally {
    // прячем прелоадер ровно один раз, в любом исходе
    preloader?.hide(0)
  }
}

loadHistoryVideos()