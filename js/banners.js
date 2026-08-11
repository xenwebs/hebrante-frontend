import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

/**
 * Баннеры полностью динамические:
 * - порядок берётся из поля `order` в Strapi
 * - количество баннеров не ограничено вёрсткой
 * - каждый баннер состоит из 1 или 2 "слотов" (banner.slot компонент):
 *     content      — обязательный, единственный слот ИЛИ левая/верхняя половина
 *     content_2    — необязательный, правая половина (когда split = true)
 * - у каждого слота своя картинка (+ мобильная), свои три текстовых блока
 *   (eyebrow/heading/subheading, каждый — необязательный), своя кнопка
 *   (необязательная, с собственными цветами) и своя цель клика
 *   (collection ИЛИ products, взаимоисключение проверяется на бэкенде)
 * - сетка продуктов создаётся под каждым слотом, у которого есть collection
 *   ИЛИ конкретные products
 * - на мобильном используется image_mobile, если оно заполнено
 * - split-баннеры делятся строго слева/направо, на мобильном верстка
 *   не переключается на "столбик" — просто сжимается
 */

// ВАЖНО: должно совпадать с брейкпоинтом в CSS (@media max-width: 768px)
const MOBILE_QUERY = "(max-width: 768px)"
const mobileMQ = window.matchMedia(MOBILE_QUERY)

// Реестр отрендеренных картинок — нужен, чтобы переключать image/image_mobile
// при ресайзе. Каждая запись — это ОДНА картинка одного слота (не баннер целиком,
// у split-баннера их две).
const imageRegistry = []

function isMobile() {
  return mobileMQ.matches
}

/**
 * Возвращает массив продуктов, вручную привязанных к слоту (или пустой массив).
 */
function getManualProducts(slotData) {
  return Array.isArray(slotData?.products) ? slotData.products : []
}

/**
 * Возвращает URL картинки слота под текущую ширину экрана.
 * Если мобильной версии нет — отдаём десктопную (обратная совместимость).
 */
function pickSlotImage(slotData) {
  const desktop = slotData?.image?.url || ""
  const mobile = slotData?.image_mobile?.url || ""
  return (isMobile() && mobile) ? mobile : desktop
}

function applyImage(imgEl, slotData, bannerSlug, isPriority) {
  if (!imgEl) return

  // Флаг для CSS: у слота есть отдельная мобильная картинка.
  // Класс вешаем всегда, а применяет его только медиазапрос.
  imgEl.classList.toggle("banner__image--has-mobile", Boolean(slotData?.image_mobile?.url))

  const url = pickSlotImage(slotData)
  if (!url) {
    console.warn(`⚠️ Баннер ${bannerSlug} — нет изображения в слоте`)
    return
  }

  // Только самая первая картинка (первый слот первого баннера) грузится
  // приоритетно, остальные — лениво.
  if (isPriority) {
    imgEl.setAttribute("fetchpriority", "high")
    imgEl.removeAttribute("loading")
  } else {
    imgEl.setAttribute("loading", "lazy")
  }

  if (imgEl.getAttribute("src") !== url) imgEl.src = url
  imgEl.style.display = "block"
}

// Переключаем картинки при смене брейкпоинта (поворот экрана, ресайз, девтулзы)
mobileMQ.addEventListener("change", () => {
  imageRegistry.forEach(({ imgEl, data, slug, isPriority }) => applyImage(imgEl, data, slug, isPriority))
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
      banners.map(b => {
        const slots = [b.content, b.content_2].filter(Boolean)
        const desc = slots.map(s => {
          const manual = getManualProducts(s)
          const source = manual.length
            ? `products(${manual.length})`
            : (s.collection?.slug ? `collection:${s.collection.slug}` : "—")
          return `${source}${s.image_mobile?.url ? " +mobile" : ""}`
        }).join(" | ")
        return `${b.order ?? "—"}: ${b.slug}${b.split ? " [split]" : ""} → ${desc}`
      }))

    // Hero-баннер уже есть в HTML (нужен для быстрого LCP) — переиспользуем его,
    // но только если он НЕ split (вёрстка hero в HTML рассчитана на одну картинку).
    // Промо-полоса (promo-bar.js) — тоже статичный элемент внутри контейнера,
    // её тоже нельзя стирать при перерисовке баннеров.
    // Всё остальное внутри контейнера чистим и генерируем заново.
    const hero = container.querySelector("[data-banner-hero]")
    const promoBar = container.querySelector("[data-promo-bar]")
    Array.from(container.children).forEach(el => {
      if (el !== hero && el !== promoBar) el.remove()
    })

    imageRegistry.length = 0
    const productTasks = []
    let heroConsumed = false

    banners.forEach((bannerData, index) => {
      const slots = [bannerData.content, bannerData.content_2].filter(Boolean)
      const isSplit = Boolean(bannerData.split) && slots.length > 1

      // Hero переиспользуем только для первого НЕ-split баннера.
      const useHero = index === 0 && hero && !isSplit
      if (index === 0 && hero && isSplit) {
        // Первый баннер сделали split — вёрстка готового hero под это не рассчитана,
        // убираем статичный hero и рендерим полноценный split-баннер вместо него.
        hero.remove()
      }

      const bannerEl = useHero ? hero : createBannerEl(isSplit)
      bannerEl.dataset.banner = bannerData.slug || ""

      if (!useHero) container.append(bannerEl)

      const slotEls = isSplit
        ? Array.from(bannerEl.querySelectorAll(".banner__half"))
        : [bannerEl]

      slots.forEach((slotData, slotIndex) => {
        const slotEl = slotEls[slotIndex]
        if (!slotEl) return

        const isPriority = !heroConsumed
        heroConsumed = true

        const imgEl = slotEl.querySelector(".banner__image")
        imageRegistry.push({ imgEl, data: slotData, slug: bannerData.slug, isPriority })
        updateSlot(slotEl, imgEl, slotData, bannerData.slug, isPriority)

        const manualProducts = getManualProducts(slotData)

        if (manualProducts.length > 0 && slotData.collection?.slug) {
          // Такого быть не должно (см. lifecycle hook в Strapi), но на всякий случай
          // защищаемся на фронте тоже — приоритет отдаём вручную выбранным продуктам.
          console.warn(
            `⚠️ Баннер ${bannerData.slug}: в слоте заполнены и collection, и products одновременно. ` +
            `Используются products, collection игнорируется.`
          )
        }

        if (manualProducts.length > 0) {
          const { section, grid } = createGridSection()
          container.append(section)
          productTasks.push(renderManualProducts(manualProducts, grid))
        } else if (slotData.collection?.slug) {
          const { section, grid } = createGridSection()
          container.append(section)
          // Запросы продуктов идут параллельно, DOM уже выстроен в правильном порядке
          productTasks.push(renderBannerProducts(slotData.collection.slug, grid))
        }
      })
    })

    await Promise.all(productTasks)
    console.log("✅ Все баннеры и сетки отрендерены")

  } catch (error) {
    console.error("❌ Ошибка загрузки баннеров:", error)
  }
}

/**
 * Создаёт DOM обычного (не split) баннера или split-баннера с двумя половинами.
 * У split-баннера каждая половина имеет ровно такую же внутреннюю структуру,
 * как обычный слот — это позволяет использовать один и тот же updateSlot()
 * для обоих случаев.
 */
function createBannerEl(isSplit) {
  const el = document.createElement("div")

  if (!isSplit) {
    el.className = "banner banner--home"
    el.innerHTML = slotInnerHTML()
    return el
  }

  el.className = "banner banner--home banner--split"
  el.innerHTML = `
    <div class="banner__half banner__half--1">${slotInnerHTML()}</div>
    <div class="banner__half banner__half--2">${slotInnerHTML()}</div>
  `
  return el
}

function slotInnerHTML() {
  return `
    <img class="banner__image" src="" alt="banner" loading="lazy">
    <div class="banner--home__content">
      <div class="banner__text"></div>
      <button type="button" class="banner__button" hidden></button>
    </div>
  `
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

/**
 * Заполняет один слот (картинка, текст, кнопка, клик) данными из Strapi.
 * slotEl — это либо весь баннер целиком (не split), либо .banner__half (split).
 */
function updateSlot(slotEl, imgEl, slotData, bannerSlug, isPriority) {
  const lang = getLanguage()

  applyImage(imgEl, slotData, bannerSlug, isPriority)

  const content = slotEl.querySelector(".banner__content") ||
                  slotEl.querySelector(".banner--home__content")
  if (!content) return

  const textWrap = content.querySelector(".banner__text")
  const buttonEl = content.querySelector(".banner__button")

  // Три независимых текстовых блока — каждый необязательный.
  const eyebrow = lang === "en" ? (slotData.eyebrow_en || slotData.eyebrow) : slotData.eyebrow
  const heading = lang === "en" ? (slotData.heading_en || slotData.heading) : slotData.heading
  const subheading = lang === "en" ? (slotData.subheading_en || slotData.subheading) : slotData.subheading

  if (textWrap) {
    const parts = []
    if (eyebrow) parts.push(`<p class="banner__eyebrow">${eyebrow}</p>`)
    if (heading) parts.push(`<p class="banner__heading">${heading}</p>`)
    if (subheading) parts.push(`<p class="banner__subheading">${subheading}</p>`)
    textWrap.innerHTML = parts.join("")
    textWrap.style.display = parts.length ? "" : "none"
  }

  // light_text — переключатель цвета текста, настраивается в Strapi.
  // Класс вешаем на content, а не на весь баннер, чтобы у split-баннера
  // каждая половина могла иметь свою настройку независимо от соседней.
  content.classList.toggle("banner--light-text", Boolean(slotData.light_text))

  // Кнопка — полностью необязательная. Если button_text (с учётом языка) пуст,
  // кнопку просто прячем, остальные button_* поля не важны.
  const buttonText = lang === "en"
    ? (slotData.button_text_en || slotData.button_text)
    : slotData.button_text

  if (buttonEl) {
    if (buttonText) {
      buttonEl.hidden = false
      buttonEl.textContent = buttonText
      buttonEl.style.backgroundColor = slotData.button_bg_color || ""
      buttonEl.style.color = slotData.button_text_color || ""
    } else {
      buttonEl.hidden = true
      buttonEl.removeAttribute("style")
    }
  }

  // Клик по слоту:
  // - привязан к коллекции → ведём на страницу коллекции
  // - привязан к одному конкретному продукту → ведём на страницу этого продукта
  // - привязан к нескольким продуктам → клик не назначаем (неоднозначно, куда вести)
  // Кнопка не имеет своего отдельного обработчика — она внутри кликабельной
  // области слота, клик по ней всплывает к тому же обработчику.
  const manualProducts = getManualProducts(slotData)
  const href = manualProducts.length === 1
    ? `/pages/product.html?slug=${manualProducts[0].slug}`
    : (manualProducts.length === 0 && slotData.collection?.slug)
      ? `/pages/collection.html?slug=${slotData.collection.slug}`
      : null

  if (href) {
    slotEl.style.cursor = "pointer"
    slotEl.onclick = () => { window.location.href = href }
  } else {
    slotEl.style.cursor = ""
    slotEl.onclick = null
  }
}

/**
 * Рендерит сетку продуктов, вручную выбранных для слота в Strapi.
 * Данные уже приходят вместе со слотом (populate в get-banners.js), поэтому
 * отдельный fetch не нужен — это ещё и быстрее, чем путь через коллекцию.
 */
async function renderManualProducts(manualProducts, productsGrid) {
  try {
    const lang = getLanguage()

    if (!manualProducts.length) return

    const products = manualProducts.map(item => ({
      title: lang === "en" ? (item.title_en || item.title) : item.title,
      price: item.price,
      formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
      slug: item.slug,
      image: item.images?.[0]?.url ? item.images[0].url : "",
      image2: item.images?.[1]?.url ? item.images[1].url : "",
      collectionSlug: item.collection?.slug,
      collectionTitle: item.collection?.title,
      discount_percent: item.discount_percent || 0
    }))

    productsGrid.innerHTML = products.map(productCard).join("")

  } catch (error) {
    console.error("❌ Ошибка рендера вручную привязанных продуктов:", error)
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