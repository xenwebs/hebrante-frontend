const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

async function loadHistoryVideos() {
  try {
    const response = await fetch(
      `${API_URL}/api/history-page?populate=videos`
    )

    const data = await response.json()

    console.log(data)

    const videos = data.data.videos

    const container = document.getElementById("history-videos")

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
        >
          <source
            src="${videoUrl}"
            type="video/mp4"
          >
        </video>
      `

      container.appendChild(wrapper)
    })

  } catch (error) {
    console.error(
      "❌ Error loading videos:",
      error
    )
  }
}

loadHistoryVideos()