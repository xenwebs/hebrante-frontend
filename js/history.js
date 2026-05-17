const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

async function loadHistoryVideos() {
  try {

    const response = await fetch(
      `${API_URL}/api/history-pages?populate=*`
    )

    const data = await response.json()

    console.log("📦 STRAPI DATA:", data)

    // Берем первую запись из collection type
    const page = data.data[0]

    if (!page) {
      console.log("❌ Нет записей history-pages")
      return
    }

    // Для Strapi v5
    const videos = page.videos

    console.log(
        "🎥 First video:",
        videos[0]

    )

    const container =
      document.getElementById("history-videos")

    if (!container) {
      console.log("❌ Container not found")
      return
    }

    container.innerHTML = ""

    videos.forEach(video => {

      const videoUrl =
        API_URL + video.url

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
          autoplay
        >
          <source
            src="${videoUrl}"
            type="video/mp4"
          >
        </video>
      `

      container.appendChild(wrapper)
    })

    console.log("✅ Videos loaded")

  } catch (error) {

    console.error(
      "❌ Error loading videos:",
      error
    )

  }
}

loadHistoryVideos()