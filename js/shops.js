import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

/* Экранирование — значения из Strapi попадают в HTML-атрибуты.
   Одна двойная кавычка в тексте ломала бы разметку. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/* Тот же приём, что в gallery.js: en берём из поля с суффиксом _en,
   если оно пустое — откатываемся на испанский */
function pickLang(source, field) {
  const lang = getLanguage()
  if (lang === "en") {
    return source[`${field}_en`] || source[field]
  }
  return source[field]
}

/* Прелоадер не должен висеть вечно, если картинка не отдалась */
function waitForImage(img, timeout = 5000) {
  if (!img || img.complete) return Promise.resolve()

  return Promise.race([
    new Promise(resolve => {
      img.addEventListener("load", resolve, { once: true })
      img.addEventListener("error", resolve, { once: true })
    }),
    new Promise(resolve => setTimeout(resolve, timeout))
  ])
}

async function loadShop() {
  const preloader = window.globalPreloader

  // раздел MARCA грузится быстро — не держим прелоадер лишнее время
  if (preloader) preloader.minShowDuration = 250

  const infoEl = document.getElementById("shop-info")
  const cityEl = document.getElementById("shop-city")
  const photoEl = document.getElementById("shop-photo")

  try {
    const response = await fetch(`${API_URL}/api/tienda-pages?populate=*`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const page = data.data?.[0]

    if (!page) {
      console.log("❌ Нет записей tienda-pages")
      return
    }

    // Strapi v5-safe: поля могут лежать плоско или в attributes
    const source = page.attributes || page

    const info = pickLang(source, "info")
    const city = pickLang(source, "city")

    let photo = source.photo
    if (Array.isArray(photo)) photo = photo[0]
    photo = photo?.data?.attributes || photo

    /* Левая колонка: каждая непустая строка поля info — свой параграф.
       bg-white обязателен: текст лежит поверх фото, белая подложка
       нужна, чтобы он читался */
    if (infoEl && info) {
      infoEl.innerHTML = String(info)
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p class="t2 bg-white">${esc(line)}</p>`)
        .join("")
    }

    if (cityEl && city) {
      cityEl.textContent = city
    }

    /* width/height из Strapi — без них браузер не резервирует место
       под картинку, и блок на старте имеет нулевую высоту */
    if (photoEl && photo?.url) {
      const dims = (photo.width && photo.height)
        ? ` width="${photo.width}" height="${photo.height}"`
        : ""

      photoEl.innerHTML = `
        <img
          class="gallery__img"
          src="${esc(photo.url)}"
          alt="${esc(photo.alternativeText || city || "HEBRANTE")}"${dims}
          decoding="async">
      `

      // ждём размеры картинки, чтобы лэйаут стал финальным до снятия прелоадера
      await waitForImage(photoEl.querySelector("img"))
    }

    console.log("✅ Tienda loaded")

  } catch (error) {
    console.error("❌ Error loading tienda:", error)
  } finally {
    // прячем прелоадер ровно один раз, в любом исходе
    preloader?.hide(0)
  }
}

loadShop()