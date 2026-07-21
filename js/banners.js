import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

/**
 * Баннеры полностью динамические:
 * - порядок берётся из поля `order` в Strapi
 * - количество баннеров не ограничено вёрсткой
 * - сетка продуктов создаётся только если у баннера есть коллекция
 */
export async function renderBanners() {
  try {
    const data = window.__bannersPromise
      ? await window.__bannersPromise
      : await fetch('/.netlify/functions/get-banners').then(r => r.json());

    if (!data?.data || data.data.length === 0) {
      console.warn("⚠️ Нет баннеров в Strapi")
      return
    }

    const container = document.querySelector("[data-banners-container]")
    if (!container) {
      console.error("❌ Не найден контейнер [data-banners-container] в HTML")
      return
    }

    // Сортировка по order. Баннеры без order уходят в конец.
    const banners = [...data.data].sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER
      const bo = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return String(a.slug || "").localeCompare(String(b.slug || ""))
    })

    console.log("✅ Баннеры загружены (в порядке order):", banners.map(b => `${b.order ?? "—"}: ${b.slug}`))

    // Hero-баннер уже есть в HTML (нужен для быстрого LCP) — переиспользуем его.
    // Всё остальное внутри контейнера чистим и генерируем заново.
    const hero = container.querySelector("[data-banner-hero]")
    Array.from(container.children).forEach(el => {
      if (el !== hero) el.remove()
    })

    const productTasks = []

    banners.forEach((bannerData, index) => {
      const bannerEl = (index === 0 && hero) ? hero : createBannerEl(index)
      bannerEl.dataset.banner = bannerData.slug || ""

      if (bannerEl !== hero) container.append(bannerEl)

      updateBanner(bannerEl, bannerData, index)

      if (bannerData.collection?.slug) {
        const { section, grid } = createGridSection()
        container.append(section)
        // Запросы продуктов запускаем параллельно, DOM уже в правильном порядке
        productTasks.push(renderBannerProducts(bannerData.collection.slug, grid))
      }
    })

    await Promise.all(productTasks)
    console.log("✅ Все баннеры и сетки отрендерены")

  } catch (error) {
    console.error("❌ Ошибка загрузки баннеров:", error)
  }
}

function createBannerEl(index) {
  const el = document.createElement("div")
  el.className = index === 0 ? "banner banner--he" : "banner banner--home"
  el.innerHTML = `
    <img class="banner__image" src="" alt="banner" loading="lazy">
    <div class="banner--home__content"></div>
  `
  return el
}

function createGridSection() {
  const section = document.createElement("section")
  section.className = "section"

  const wrap = document.createElement("div")
  wrap.className = "container"

  const grid = document.createElement("div")
  grid.className = "products-grid"

  wrap.append(grid)
  section.append(wrap)
  return { section, grid }
}

function updateBanner(bannerEl, bannerData, index) {
  const lang = getLanguage()
  const img = bannerEl.querySelector(".banner__image")

  if (img && bannerData.image?.url) {
    // Первый баннер грузим приоритетно, остальные — лениво
    if (index === 0) {
      img.setAttribute("fetchpriority", "high")
      img.removeAttribute("loading")
    } else {
      img.setAttribute("loading", "lazy")
    }
    if (img.src !== bannerData.image.url) img.src = bannerData.image.url
    img.style.display = "block"
  } else {
    console.warn(`⚠️ Баннер ${bannerData.slug} — нет изображения`)
  }

  const content = bannerEl.querySelector(".banner__content") ||
                  bannerEl.querySelector(".banner--home__content")

  if (content) {
    const title = lang === "en"
      ? (bannerData.title_en || bannerData.title || "")
      : (bannerData.title || "")

    const cta = lang === "en" ? "Shop" : "Comprar"

    // Опциональный тёмный текст: булево поле в Strapi (dark_text или black)
    content.classList.toggle("black", Boolean(bannerData.dark_text ?? bannerData.black))

    content.innerHTML = title
      ? `
      <div class="line">
        <p class="banner__text">${title}</p>
        <p class="banner__text">${cta}</p>
      </div>
    `
      : ""
  }

  if (bannerData.collection?.slug) {
    bannerEl.style.cursor = "pointer"
    bannerEl.onclick = () => {
      window.location.href = `/pages/collection.html?slug=${bannerData.collection.slug}`
    }
  } else {
    bannerEl.style.cursor = ""
    bannerEl.onclick = null
  }
}

async function renderBannerProducts(collectionSlug, productsGrid) {
  try {
    const lang = getLanguage()

    const productsRes = await fetch(
      `/.netlify/functions/get-products?collection=${collectionSlug}`
    )
    const productsData = await productsRes.json()

    if (productsData.data && productsData.data.length > 0) {
      const products = productsData.data.slice(0, 3).map(item => ({
        title: lang === "en" ? (item.title_en || item.title) : item.title,
        price: item.price,
        formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
        slug: item.slug,
        image: item.images?.[0]?.url ? item.images[0].url : "",
        image2: item.images?.[1]?.url ? item.images[1].url : "",
        collectionSlug: item.collection?.slug,
        collectionTitle: item.collection?.title
      }))

      productsGrid.innerHTML = products.map(productCard).join("")
    } else {
      console.warn(`⚠️ Нет продуктов для ${collectionSlug}`)
    }

  } catch (error) {
    console.error(`❌ Ошибка загрузки продуктов для ${collectionSlug}:`, error)
  }
}