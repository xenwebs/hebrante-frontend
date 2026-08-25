// ============================================
// ОБЩИЙ ХЕЛПЕР ДЛЯ МЕДИА (раздел MARCA)
// ============================================

/**
 * Ждёт, пока браузер узнает реальные размеры видео (loadedmetadata).
 * Это важно: у .video стоит height: auto, поэтому до метаданных
 * высота элемента = 0, и лэйаут ещё не финальный.
 *
 * Возвращается досрочно по таймауту, чтобы не залипнуть на медленной сети.
 */
export function waitForVideosReady(root, { limit = 4, timeout = 3000 } = {}) {
  return new Promise(resolve => {
    // двойной rAF = браузер точно успел разложить лэйаут
    const done = () =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))

    if (!root) return done()

    const videos = Array.from(root.querySelectorAll('video'))
      .slice(0, limit)          // ждём только первый экран
      .filter(v => v.readyState < 1)   // 0 = HAVE_NOTHING

    if (!videos.length) return done()

    let left = videos.length
    const tick = () => {
      if (--left <= 0) {
        clearTimeout(t)
        done()
      }
    }

    videos.forEach(v => {
      v.addEventListener('loadedmetadata', tick, { once: true })
      v.addEventListener('error', tick, { once: true })
      // ошибка сети приходит на <source>, а не на сам <video>
      v.querySelector('source')
        ?.addEventListener('error', tick, { once: true })
    })

    const t = setTimeout(done, timeout)
  })
}

/**
 * Play/pause по видимости.
 * Вызывается ПОСЛЕ рендера видео (в main.js этот код срабатывает
 * слишком рано и на динамических видео не попадает).
 */
export function initVideoAutoplay(root = document) {
  const videos = root.querySelectorAll('.video')
  if (!videos.length) return

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.play().catch(() => {})
      } else {
        entry.target.pause()
      }
    })
  }, { threshold: 0.5 })

  videos.forEach(video => observer.observe(video))
}
