const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

async function loadWorkshopVideos() {
  try {

    const response = await fetch(
      `${API_URL}/api/workshop-pages?populate=*`
    )

    const data = await response.json()

    console.log("📦 WORKSHOP STRAPI DATA:", data)

    const page = data.data[0]

    if (!page) {
      console.log("❌ Нет записей workshop-pages")
      return
    }

    // ⚠️ Strapi v5-safe access (на случай attributes)
    const videos =
      page.videos ||
      page.attributes?.videos

    console.log("🎥 Workshop videos:", videos?.[0])

    const container =
      document.querySelector(".workshop__block")

    if (!container) {
      console.log("❌ workshop container not found")
      return
    }

    container.innerHTML = ""

    if (!Array.isArray(videos) || videos.length === 0) {
      console.log("❌ Нет видео в workshop")
      return
    }

    videos.forEach(video => {

      // 💥 ВАЖНО: не склеиваем URL (как ты уже исправила раньше)
      const videoUrl = video.url

      if (!videoUrl) return

      const wrapper =
        document.createElement("div")

      wrapper.className = "video-wrapper"

      wrapper.innerHTML = `
        <video
          class="video"
          muted
          loop
          playsinline
          preload="metadata"
        >
          <source src="${videoUrl}" type="video/mp4">
        </video>
      `

      container.appendChild(wrapper)
    })

    console.log("✅ Workshop videos loaded")

  } catch (error) {

    console.error(
      "❌ Error loading workshop videos:",
      error
    )

  }
}

loadWorkshopVideos()