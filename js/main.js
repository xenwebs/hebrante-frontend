import { initHeader } from "./header.js"
import { initFooter } from "./footer.js"
import { renderAllProducts } from "./products.js"
import { renderBasicsProducts } from "./products.js"
import { renderBanners } from "./banners.js"
import { renderGallery } from "./gallery.js"
import { renderCollections, renderCollectionDetail } from "./collections.js"
import { updateCartCount } from "./cart.js"
import { initLanguage, translatePage } from "./lang.js"

async function loadComponent(id, path, callback) {
  try {
    const res = await fetch(path)
    const html = await res.text()
    const container = document.getElementById(id)
    if (!container) return
    container.innerHTML = html

    requestAnimationFrame(() => {
      if (callback) callback()
      translatePage()
    })
  } catch (error) {
    console.error(`Error loading component: ${path}`, error)
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initLanguage()

  // ✅ Загрузи header
  const headerContainer = document.getElementById("header")
  if (headerContainer && !headerContainer.innerHTML.trim()) {
    await loadComponent("header", "/components/header.html", initHeader)
  } else if (headerContainer && headerContainer.innerHTML.trim()) {
    requestAnimationFrame(() => {
      initHeader()
      translatePage()
    })
  }

  // ✅ Загрузи footer
  const footerContainer = document.getElementById("footer")
  if (footerContainer && !footerContainer.innerHTML.trim()) {
    await loadComponent("footer", "/components/footer.html", initFooter)
  }

  // ✅ ОПРЕДЕЛИ ЧТО ЭТО ЗА СТРАНИЦА И ЗАГРУЗИ КОНТЕНТ
  const path = window.location.pathname

  updateCartCount()

  // Главная страница
  if (path === '/' || path === '/index.html') {
    await renderBanners()  // ← Баннеры с продуктами
  }

  // Страница "Все товары"
  if (path.includes('/all')) {
    await renderAllProducts()
  }

  // Страница Basics
  if (path.includes('/basics')) {
    await renderBasicsProducts()
  }

  // Страница галереи
  if (path.includes('/gallery')) {
    await renderGallery()
  }

  // Страница коллекций
  if (path.includes('/collections')) {
    await renderCollections()
  }

  // Страница одной коллекции
  if (path.includes('collection.html')) {
    await renderCollectionDetail()
  }

  initVideoAutoplay()

  // ✅ Ждём, пока контент реально отрисуется, и только потом прячем прелоадер
  await waitForContentReady()

  if (!window.globalPreloader) {
    console.warn('⚠️ globalPreloader не найден — проверь порядок подключения preloader.js')
  }
  window.globalPreloader?.hide(150)
})

/**
 * Ждёт загрузки первых картинок в сетке + два кадра отрисовки.
 * Возвращается досрочно по таймауту, чтобы не залипнуть навсегда.
 */
function waitForContentReady({ imageLimit = 8, timeout = 4000 } = {}) {
  return new Promise(resolve => {
    // двойной rAF = гарантия что браузер успел разложить лэйаут
    const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve))

    const imgs = Array.from(
      document.querySelectorAll(
        '[data-all-products] img, [data-basics-products] img, .products-grid img, .banner img'
      )
    )
      .slice(0, imageLimit)   // только первый экран, остальное догрузится лениво
      .filter(img => !img.complete)

    if (!imgs.length) return done()

    let left = imgs.length
    const tick = () => { if (--left <= 0) { clearTimeout(t); done() } }

    imgs.forEach(img => {
      img.addEventListener('load', tick, { once: true })
      img.addEventListener('error', tick, { once: true })
    })

    const t = setTimeout(done, timeout)
  })
}

function initVideoAutoplay() {
  const videos = document.querySelectorAll('.video')
  if (!videos.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.play()
      } else {
        entry.target.pause()
      }
    })
  }, {
    threshold: 0.5
  })

  videos.forEach(video => observer.observe(video))
}