import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

/**
 * Баннер коллекции (внутренняя страница /pages/collection.html):
 * - banner        — десктопная картинка (1x), обязательная
 * - banner2x      — retina-версия десктопной картинки (необязательная)
 * - banner_mobile — отдельная адаптивная картинка для телефонов (необязательная)
 *
 * Логика та же, что у баннеров на главной (banners.js):
 * если banner_mobile заполнен и ширина экрана <= 768px — показываем его,
 * иначе — обычную десктопную пару banner/banner2x.
 *
 * ВАЖНО: должно совпадать с брейкпоинтом в CSS (@media max-width: 768px)
 */
const MOBILE_QUERY = "(max-width: 768px)"
const mobileMQ = window.matchMedia(MOBILE_QUERY)

// На странице коллекции баннер один, поэтому вместо реестра (как в banners.js)
// достаточно запомнить последнюю отрендеренную пару "картинка + данные",
// чтобы переключать источник при ресайзе / повороте экрана.
const bannerState = { imgEl: null, collection: null }

function isMobile() {
  return mobileMQ.matches
}

export function collectionCard(collection) {
    return `
    <a href="javascript:void(0)" onclick="window.location.href='/pages/collection.html?slug=${collection.slug}'" class="collection-card">
        <img src="${collection.image}" alt="${collection.title}" />
        <p class="t1">${collection.title}</p>
    </a>
    `
}

export async function renderCollections() {
  // ✅ показываем прелоадер на время загрузки коллекций
  window.globalPreloader?.show()

  try {
    const lang = getLanguage()
    const res = await fetch(`${API_URL}/api/collections?populate=*`)
    const data = await res.json()

    console.log("📦 Collections data:", data)

    const collections = data.data.map(item => ({
      // ✅ перевод названия коллекции на карточках collections.html
      title: lang === 'en' ? (item.name_en || item.name) : item.name,
      slug: item.slug,
      image: item.cover?.url ? item.cover.url : ""
    }))

    const grid = document.querySelector(".collections-grid")
    if (!grid) {
      console.error("❌ Grid контейнер не найден")
      return
    }

    grid.innerHTML = collections.map(collectionCard).join("")
    console.log("✅ Collections рендерены!")

  } catch (error) {
    console.error("❌ Ошибка загрузки коллекций:", error)
  } finally {
    // ✅ скрываем прелоадер независимо от результата (успех/ошибка)
    window.globalPreloader?.hide()
  }
}

/**
 * Выставляет src/srcset баннера под текущую ширину экрана.
 *
 * ⚠️ Ключевой момент: srcset имеет ПРИОРИТЕТ над src. Если просто подменить src
 * на мобильную картинку, но оставить старый srcset — браузер продолжит грузить
 * десктопную версию. Поэтому в мобильной ветке srcset обязательно удаляется,
 * а в десктопной — выставляется заново.
 */
function applyCollectionBannerImage(imgEl, collection) {
  if (!imgEl) return

  const desktop1x = collection.banner?.url || ""
  const desktop2x = collection.banner2x?.url || desktop1x
  const mobile = collection.banner_mobile?.url || ""

  // Флаг для CSS: у коллекции есть отдельная мобильная картинка.
  // Класс вешаем всегда, а применяет его только медиазапрос.
  imgEl.classList.toggle("banner__image--has-mobile", Boolean(mobile))

  if (!desktop1x && !mobile) {
    console.warn("⚠️ Нет картинки баннера в Strapi")
    return
  }

  if (isMobile() && mobile) {
    imgEl.removeAttribute("srcset")
    if (imgEl.getAttribute("src") !== mobile) imgEl.src = mobile
    console.log("🖼️ Баннер коллекции: мобильная версия →", mobile)
  } else {
    // Если десктопной картинки нет вовсе — показываем мобильную как запасной вариант.
    const src1x = desktop1x || mobile
    const src2x = desktop1x ? desktop2x : mobile
    if (imgEl.getAttribute("src") !== src1x) imgEl.src = src1x
    imgEl.srcset = `${src1x} 1x, ${src2x} 2x`
    console.log("🖼️ Баннер коллекции: десктопная версия →", src1x)
  }

  // Баннер коллекции — первый экран (LCP), грузим приоритетно.
  imgEl.setAttribute("fetchpriority", "high")
  imgEl.removeAttribute("loading")
  imgEl.style.display = "block"
}

// Переключаем картинку при смене брейкпоинта (поворот экрана, ресайз, девтулзы)
mobileMQ.addEventListener("change", () => {
  if (bannerState.imgEl && bannerState.collection) {
    applyCollectionBannerImage(bannerState.imgEl, bannerState.collection)
  }
})

function renderCollectionBanner(collection) {
  const bannerEl = document.getElementById("collection-banner")
  if (!bannerEl) {
    console.warn("⚠️ Баннер контейнер не найден")
    return
  }

  const img = bannerEl.querySelector(".banner__image")
  if (!img) {
    console.warn("⚠️ .banner__image внутри #collection-banner не найден")
    return
  }

  bannerState.imgEl = img
  bannerState.collection = collection

  applyCollectionBannerImage(img, collection)
  console.log("✅ Баннер коллекции рендерен!")
}

export async function renderCollectionDetail() {
  // ✅ показываем прелоадер на время загрузки коллекции + продуктов
  window.globalPreloader?.show()

  try {
    const lang = getLanguage()

    const urlParams = new URLSearchParams(window.location.search)
    const slug = urlParams.get("slug")

    if (!slug) {
      console.error("❌ Slug не найден в URL")
      return
    }

    console.log("🔍 Загружаю коллекцию:", slug)

    const res = await fetch(`${API_URL}/api/collections?filters[slug][$eq]=${slug}&populate=*`)
    const data = await res.json()

    if (!data.data || data.data.length === 0) {
      console.error("❌ Коллекция не найдена")
      return
    }

    const collection = data.data[0]
    console.log("✅ Коллекция загружена:", collection)

    renderCollectionBanner(collection)

    // ✅ перевод заголовка коллекции на collection.html
    const title = document.querySelector(".h1")
    if (title) {
      title.textContent = lang === 'en' ? (collection.name_en || collection.name) : collection.name
    }

    const productsRes = await fetch(
      `${API_URL}/api/products?filters[collection][slug][$eq]=${slug}&populate=*`
    )
    const productsData = await productsRes.json()

    console.log("📦 Продукты:", productsData.data)

    const firstGrid = document.querySelector(".products-grid")

    if (firstGrid && productsData.data) {
      const products = productsData.data.map(item => {
        const imageUrl  = item.images?.[0]?.url || ""
        const imageUrl2 = item.images?.[1]?.url || ""   // ✅ вторая картинка для hover

        return {
          // ✅ перевод названий продуктов внутри коллекции
          title: lang === 'en' ? (item.title_en || item.title) : item.title,
          price: item.price,
          formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
          slug: item.slug,
          image: imageUrl,
          imageWebP: imageUrl.replace(/\.jpg$/, ".webp"),
          image2: imageUrl2,                                // ✅
          imageWebP2: imageUrl2.replace(/\.jpg$/, ".webp"), // ✅
          collectionSlug: item.collection?.slug,
          collectionTitle: item.collection?.name,
          discount_percent: item.discount_percent || 0      // ✅ скидка
        }
      })

      const parent = firstGrid.parentElement

      // Чистим старые гриды (на случай повторного рендера)
      parent.querySelectorAll(".products-grid").forEach(g => g.remove())

      // По одному .products-grid на каждые 3 продукта — как на остальных страницах
      for (let i = 0; i < products.length; i += 3) {
        const grid = document.createElement("div")
        grid.className = "products-grid"

        const chunk = products.slice(i, i + 3)
        let html = chunk.map(productCard).join("")

        // ✅ добиваем неполный последний ряд невидимыми карточками,
        // чтобы реальные прижались влево нормальной шириной
        const missing = 3 - chunk.length
        for (let j = 0; j < missing; j++) {
          html += `<div class="product-card product-card--ghost" aria-hidden="true"></div>`
        }

        grid.innerHTML = html
        parent.appendChild(grid)
      }

      console.log("✅ Продукты рендерены по 3 в ряд!")
    }

  } catch (error) {
    console.error("❌ Ошибка загрузки деталей коллекции:", error)
  } finally {
    // ✅ скрываем прелоадер независимо от результата (успех/ошибка)
    window.globalPreloader?.hide()
  }
}