import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

/**
 * Баннеры полностью динамические:
 * - порядок берётся из поля `order` в Strapi
 * - количество баннеров не ограничено вёрсткой
 * - сетка продуктов создаётся только если у баннера есть коллекция
 * - на мобильном используется image_mobile, если оно заполнено
 */

// ВАЖНО: должно совпадать с брейкпоинтом в CSS (@media max-width: 768px)
const MOBILE_QUERY = "(max-width: 768px)"
const mobileMQ = window.matchMedia(MOBILE_QUERY)

// Реестр отрендеренных баннеров — нужен, чтобы переключать картинки при ресайзе
const bannerRegistry = []

function isMobile() {
  return mobileMQ.matches
}

/**
 * Возвращает URL картинки под текущую ширину экрана.
 * Если мобильной версии нет — отдаём десктопную (обратная совместимость).
 */
function pickBannerImage(bannerData) {
  const desktop = bannerData?.image?.url || ""
  const mobile = bannerData?.image_mobile?.url || ""
  return (isMobile() && mobile) ? mobile : desktop
}

function applyBannerImage(bannerEl, bannerData, index) {
  const img = bannerEl.querySelector(".banner__image")
  if (!img) return

  // Флаг для CSS: у баннера есть отдельная мобильная картинка.
  // Класс вешаем всегда, а применяет его только медиазапрос.
  bannerEl.classList.toggle("banner--has-mobile", Boolean(bannerData?.image_mobile?.url))

  const url = pickBannerImage(bannerData)
  if (!url) {
    console.warn(`⚠️ Баннер ${bannerData.slug} — нет изображения`)
    return
  }

  // Первый баннер грузим приоритетно, остальные — лениво
  if (index === 0) {
    img.setAttribute("fetchpriority", "high")
    img.removeAttribute("loading")
  } else {
    img.setAttribute("loading", "lazy")
  }

  if (img.getAttribute("src") !== url) img.src = url
  img.style.display = "block"
}

// Переключаем картинки при смене брейкпоинта (поворот экрана, ресайз, девтулзы)
mobileMQ.addEventListener("change", () => {
  bannerRegistry.forEach(({ el, data, index }) => applyBannerImage(el, data, index))
})

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

    // Сортировка по order.
    // Если order не пришёл (например, забыли добавить его в fields в get-banners.js),
    // сохраняем порядок, в котором данные отдал Strapi (там уже sort=order:asc),
    // а не пересортировываем по алфавиту.
    const banners = data.data
      .map((banner, i) => ({ banner, i }))
      .sort((x, y) => {
        const ao = Number.isFinite(x.banner.order) ? x.banner.order : Number.MAX_SAFE_INTEGER
        const bo = Number.isFinite(y.banner.order) ? y.banner.order : Number.MAX_SAFE_INTEGER
        if (ao !== bo) return ao - bo
        return x.i - y.i
      })
      .map(({ banner }) => banner)

    console.log("✅ Баннеры загружены (в порядке order):",
      banners.map(b => `${b.order ?? "—"}: ${b.slug}${b.image_mobile?.url ? " [+mobile]" : ""}`))

    // Hero-баннер уже есть в HTML (нужен для быстрого LCP) — переиспользуем его.
    // Всё остальное внутри контейнера чистим и генерируем заново.
    const hero = container.querySelector("[data-banner-hero]")
    Array.from(container.children).forEach(el => {
      if (el !== hero) el.remove()
    })

    bannerRegistry.length = 0
    const productTasks = []

    banners.forEach((bannerData, index) => {
      const bannerEl = (index === 0 && hero) ? hero : createBannerEl(index)
      bannerEl.dataset.banner = bannerData.slug || ""

      if (bannerEl !== hero) container.append(bannerEl)

      bannerRegistry.push({ el: bannerEl, data: bannerData, index })
      updateBanner(bannerEl, bannerData, index)

      if (bannerData.collection?.slug) {
        const { section, grid } = createGridSection()
        container.append(section)
        // Запросы продуктов идут параллельно, DOM уже выстроен в правильном порядке
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

  applyBannerImage(bannerEl, bannerData, index)

  const content = bannerEl.querySelector(".banner__content") ||
                  bannerEl.querySelector(".banner--home__content")

  if (content) {
    const title = lang === "en"
      ? (bannerData.title_en || bannerData.title || "")
      : (bannerData.title || "")

    const cta = lang === "en" ? "Shop" : "Comprar"

    // Опциональный тёмный текст: булево поле в Strapi (dark_text или black).
    // Пока такого поля нет — класс просто не вешается.
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
        collectionTitle: item.collection?.title,
        discount_percent: item.discount_percent || 0      // ✅ скидка
      }))

      productsGrid.innerHTML = products.map(productCard).join("")
    } else {
      console.warn(`⚠️ Нет продуктов для ${collectionSlug}`)
    }

  } catch (error) {
    console.error(`❌ Ошибка загрузки продуктов для ${collectionSlug}:`, error)
  }
}