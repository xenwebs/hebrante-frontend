import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

/**
 * Баннеры полностью динамические:
 * - порядок берётся из поля `order` в Strapi
 * - количество баннеров не ограничено вёрсткой
 * - каждый баннер состоит из 1 или 2 "слотов" (banner.slot компонент):
 *     content      — обязательный, единственный слот ИЛИ левая/верхняя половина
 *     content_2    — необязательный, правая половина (когда split = true)
 * - у каждого слота своя картинка (+ мобильная), необязательное видео
 *   (+ мобильное), свои три текстовых блока (eyebrow/heading/subheading,
 *   каждый — необязательный), необязательный таймер обратного отсчёта
 *   (countdown_until — дата/время в Strapi, рендерится сразу под heading),
 *   своя кнопка (необязательная, с собственными
 *   цветами), своё горизонтальное выравнивание текстового блока
 *   (content_align) и своя цель клика
 *   (collection ИЛИ products, взаимоисключение проверяется на бэкенде)
 * - сетка продуктов создаётся под каждым слотом, у которого есть collection
 *   ИЛИ конкретные products
 * - на мобильном используются image_mobile / video_mobile, если заполнены
 * - split-баннеры делятся строго слева/направо, на мобильном верстка
 *   не переключается на "столбик" — просто сжимается
 *
 * ВИДЕО:
 * Картинка слота остаётся обязательной всегда — она задаёт высоту баннера,
 * работает постером и остаётся единственным, что видно, если видео не
 * запустилось. Видео лежит поверх картинки абсолютом и не влияет на layout.
 * Не запуститься оно может законно и часто: режим энергосбережения на iOS,
 * системная настройка "уменьшить движение", неподдерживаемый кодек.
 * Во всех этих случаях молча остаётся постер — это не ошибка.
 */

// ВАЖНО: должно совпадать с брейкпоинтом в CSS (@media max-width: 768px)
const MOBILE_QUERY = "(max-width: 768px)"
const mobileMQ = window.matchMedia(MOBILE_QUERY)

// Системная настройка "уменьшить движение". Если она включена — видео не
// грузим вообще (не просто прячем): человеку оно не нужно, а трафик экономим.
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const reducedMotionMQ = window.matchMedia(REDUCED_MOTION_QUERY)

// Допустимые значения enum-поля `content_align` в Strapi.
// Выравнивание ТОЛЬКО по горизонтали — по вертикали блок всегда прижат к низу
// баннера (это задано в CSS и в Strapi не настраивается).
const CONTENT_ALIGN_VALUES = ["left", "center", "right"]
const CONTENT_ALIGN_DEFAULT = "left"

// Реестр отрендеренных слотов — нужен, чтобы переключать desktop/mobile версии
// картинки и видео при ресайзе. Каждая запись — ОДИН слот (у split-баннера их две).
const mediaRegistry = []

// Порядок и подписи блоков таймера обратного отсчёта. Задаётся полем
// countdown_until (datetime) в слоте — если оно пустое, таймер не рендерится.
// По умолчанию на сайте испанский (getLanguage() отдаёт "es"), поэтому
// fallback — тоже испанский, а не русский (русского на сайте нет и не должно быть).
const COUNTDOWN_UNITS = ["days", "hours", "minutes", "seconds"]
const COUNTDOWN_LABELS = {
  es: { days: "DÍAS", hours: "HORAS", minutes: "MIN", seconds: "SEG" },
  en: { days: "DAYS", hours: "HRS", minutes: "MIN", seconds: "SEC" }
}

// Реестр id активных setInterval таймеров — нужен по той же причине, что и
// mediaRegistry: при каждом полном перерендере баннеров (renderBanners())
// старые таймеры нужно гасить явно, иначе они продолжат тикать в фоне поверх
// уже удалённых из DOM элементов и будут накапливаться с каждым вызовом.
const countdownRegistry = []

// Наблюдатель видимости: видео играет только пока баннер в зоне видимости.
// Без этого три-четыре автоплеящихся ролика ниже первого экрана будут
// молотить в фоне и жрать батарею.
let visibilityObserver = null

function isMobile() {
  return mobileMQ.matches
}

function prefersReducedMotion() {
  return reducedMotionMQ.matches
}

/**
 * Возвращает массив продуктов, вручную привязанных к слоту (или пустой массив).
 */
function getManualProducts(slotData) {
  return Array.isArray(slotData?.products) ? slotData.products : []
}

/**
 * Возвращает горизонтальное выравнивание текстового блока слота.
 * Если поле не заполнено (старые баннеры, созданные до добавления поля),
 * не пришло из API или содержит мусор — отдаём "left", то есть поведение
 * ровно такое же, как было раньше.
 */
function getContentAlign(slotData) {
  const raw = String(slotData?.content_align ?? "").trim().toLowerCase()
  return CONTENT_ALIGN_VALUES.includes(raw) ? raw : CONTENT_ALIGN_DEFAULT
}

/**
 * Вешает на контейнер контента ровно один класс выравнивания и снимает остальные.
 * Снимать остальные обязательно: hero-баннер переиспользуется из статичного HTML,
 * и при повторном рендере на нём мог остаться класс от прошлого значения.
 */
function applyContentAlign(contentEl, slotData) {
  if (!contentEl) return
  const align = getContentAlign(slotData)
  CONTENT_ALIGN_VALUES.forEach(value => {
    contentEl.classList.toggle(`banner__content--align-${value}`, value === align)
  })
}

/**
 * Возвращает { days, hours, minutes, seconds } от текущего момента до
 * targetMs. Каждое поле не может быть отрицательным — если время уже
 * прошло, везде нули (а не отрицательные числа).
 */
function getCountdownParts(targetMs) {
  const diff = Math.max(0, targetMs - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  }
}

function pad2(n) {
  return String(n).padStart(2, "0")
}

/**
 * Разметка таймера. Значения лежат в data-unit — updateCountdownEl()
 * находит их по этому атрибуту и обновляет раз в секунду точечно,
 * не пересобирая innerHTML целиком (не сбивает анимации/фокус на кнопке рядом).
 */
function countdownHTML(lang) {
  const labels = COUNTDOWN_LABELS[lang] || COUNTDOWN_LABELS.es
  const items = COUNTDOWN_UNITS.map(unit => `
    <div class="banner__countdown-item">
      <span class="banner__countdown-value" data-unit="${unit}">00</span>
      <span class="banner__countdown-label">${labels[unit]}</span>
    </div>`).join("")
  return `<div class="banner__countdown">${items}</div>`
}

function updateCountdownEl(el, targetMs) {
  const parts = getCountdownParts(targetMs)
  COUNTDOWN_UNITS.forEach(unit => {
    const valueEl = el.querySelector(`[data-unit="${unit}"]`)
    if (valueEl) valueEl.textContent = pad2(parts[unit])
  })
  return parts
}

/**
 * Запускает тикающий таймер внутри уже вставленной в DOM разметки
 * (countdownHTML()), если у слота задан countdown_until.
 * Если дата не задана или не парсится — просто убирает пустой блок таймера
 * (он мог остаться в разметке от countdownHTML(), вызванного "на всякий
 * случай" выше по коду — здесь единственная точка, которая решает, жить ему
 * или нет).
 * Если время уже истекло на момент рендера — таймер прячется сразу,
 * setInterval не заводится.
 */
function setupCountdown(content, slotData, lang) {
  const countdownEl = content.querySelector(".banner__countdown")
  if (!countdownEl) return

  const targetMs = Date.parse(slotData.countdown_until || "")
  if (!Number.isFinite(targetMs)) {
    countdownEl.remove()
    return
  }

  const tick = () => {
    const parts = updateCountdownEl(countdownEl, targetMs)
    const isOver = targetMs <= Date.now()
    if (isOver) {
      // Коллекция уже вышла — таймер своё отработал, дальше "00:00:00:00"
      // висеть незачем. Прячем блок и останавливаем интервал.
      countdownEl.hidden = true
      clearInterval(intervalId)
    }
  }

  tick()
  const intervalId = setInterval(tick, 1000)
  countdownRegistry.push(intervalId)
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

/**
 * Возвращает { url, mime } видео слота под текущую ширину экрана или null,
 * если видео у слота нет. Логика выбора та же, что у картинок: мобильное
 * используется только если оно реально загружено.
 */
function pickSlotVideo(slotData) {
  const desktop = slotData?.video
  const mobile = slotData?.video_mobile
  const chosen = (isMobile() && mobile?.url) ? mobile : desktop
  if (!chosen?.url) return null
  return { url: chosen.url, mime: chosen.mime || "" }
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

/**
 * Находит <video> слота, а если его нет в разметке — создаёт.
 * Второй случай — это hero: он лежит статикой в index.html и про видео
 * ничего не знает. Так правка index.html не требуется.
 */
function ensureVideoEl(slotEl, imgEl) {
  const existing = slotEl.querySelector(".banner__video")
  if (existing) return existing

  const videoEl = document.createElement("video")
  videoEl.className = "banner__video"
  // muted + playsinline — обязательное условие автоплея во всех браузерах.
  // Ставим и свойством, и атрибутом: свойство надёжнее для уже созданного
  // элемента, атрибут — для тех браузеров, что смотрят на разметку.
  videoEl.muted = true
  videoEl.defaultMuted = true
  videoEl.setAttribute("muted", "")
  videoEl.setAttribute("playsinline", "")
  videoEl.setAttribute("webkit-playsinline", "")
  videoEl.setAttribute("disablepictureinpicture", "")
  videoEl.loop = true
  videoEl.hidden = true
  videoEl.append(document.createElement("source"))

  if (imgEl?.parentNode) imgEl.insertAdjacentElement("afterend", videoEl)
  else slotEl.prepend(videoEl)

  return videoEl
}

/**
 * Пытается запустить видео. play() возвращает промис, который отклоняется,
 * если браузер автоплей не разрешил — тогда прячем видео и оставляем постер.
 * AbortError игнорируем: он прилетает, когда pause() случился раньше, чем
 * успел стартовать play() (например, пользователь быстро проскроллил мимо).
 */
function safePlay(videoEl) {
  const attempt = videoEl.play()
  if (!attempt?.catch) return
  attempt.catch(error => {
    if (error?.name === "AbortError") return
    videoEl.hidden = true
  })
}

function getVisibilityObserver() {
  if (visibilityObserver || !("IntersectionObserver" in window)) return visibilityObserver

  visibilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const videoEl = entry.target
      if (videoEl.hidden) return
      if (entry.isIntersecting) safePlay(videoEl)
      else videoEl.pause()
    })
  }, { rootMargin: "200px 0px" })

  return visibilityObserver
}

/**
 * Настраивает видео слота. Вызывается и при первом рендере, и при смене
 * брейкпоинта — поэтому обязан уметь как включать видео, так и выключать
 * его обратно (например, на мобильном видео есть, а на десктопе нет).
 */
function applyVideo(videoEl, slotData, bannerSlug, isPriority) {
  if (!videoEl) return

  const video = prefersReducedMotion() ? null : pickSlotVideo(slotData)
  const sourceEl = videoEl.querySelector("source") ||
                   videoEl.appendChild(document.createElement("source"))
  const currentUrl = sourceEl.getAttribute("src") || ""

  // Видео нет (или отключено настройкой движения) — выключаем и чистим,
  // чтобы браузер не держал загруженный файл в памяти.
  if (!video) {
    getVisibilityObserver()?.unobserve(videoEl)
    videoEl.hidden = true
    videoEl.pause()
    if (currentUrl) {
      sourceEl.removeAttribute("src")
      sourceEl.removeAttribute("type")
      videoEl.load()
    }
    return
  }

  videoEl.muted = true
  videoEl.loop = true
  videoEl.poster = pickSlotImage(slotData)
  // Первый баннер на экране сразу тянет метаданные, остальные ждут,
  // пока к ним доскроллят — за этим следит IntersectionObserver ниже.
  videoEl.preload = isPriority ? "metadata" : "none"
  videoEl.hidden = false

  if (currentUrl !== video.url) {
    sourceEl.setAttribute("src", video.url)
    // type помогает браузеру отсечь неподдерживаемый формат (например,
    // quicktime от клиента) не скачивая файл — останется просто постер.
    if (video.mime) sourceEl.setAttribute("type", video.mime)
    else sourceEl.removeAttribute("type")
    videoEl.load()
  }

  if (!video.mime) {
    console.warn(`⚠️ Баннер ${bannerSlug} — у видео не пришёл mime, браузер определит формат сам`)
  }

  const observer = getVisibilityObserver()
  if (observer) {
    observer.observe(videoEl)
  } else {
    // Старый браузер без IntersectionObserver — играем сразу, без ленивости.
    safePlay(videoEl)
  }
}

function applySlotMedia({ imgEl, videoEl, data, slug, isPriority }) {
  applyImage(imgEl, data, slug, isPriority)
  applyVideo(videoEl, data, slug, isPriority)
}

// Переключаем медиа при смене брейкпоинта (поворот экрана, ресайз, девтулзы)
mobileMQ.addEventListener("change", () => {
  mediaRegistry.forEach(applySlotMedia)
})

// И при смене системной настройки "уменьшить движение" — тогда видео
// либо подгружается, либо выгружается на лету.
reducedMotionMQ.addEventListener("change", () => {
  mediaRegistry.forEach(applySlotMedia)
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
          const media = [
            s.image_mobile?.url ? "+mobile" : "",
            s.video?.url ? "+video" : "",
            s.video_mobile?.url ? "+video_mobile" : ""
          ].filter(Boolean).join(" ")
          // align и медиа показываем в логе — сразу видно, что дошло из API
          return `${source}${media ? " " + media : ""} @${getContentAlign(s)}`
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

    // Старые <video> из прошлого рендера отписываем от наблюдателя:
    // сами элементы уже удалены из DOM, но ссылки на них держал observer.
    visibilityObserver?.disconnect()
    visibilityObserver = null

    mediaRegistry.length = 0

    // Старые таймеры гасим здесь же, а не в setupCountdown(): их элементы
    // сейчас будут удалены вместе со старыми баннерами, и до этой точки
    // они успели бы натикать ещё один-два раза впустую.
    countdownRegistry.forEach(id => clearInterval(id))
    countdownRegistry.length = 0

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
        const videoEl = ensureVideoEl(slotEl, imgEl)

        const mediaEntry = {
          imgEl,
          videoEl,
          data: slotData,
          slug: bannerData.slug,
          isPriority
        }
        mediaRegistry.push(mediaEntry)
        updateSlot(slotEl, mediaEntry, slotData)

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
  // Класс выравнивания здесь не ставим — его вешает applyContentAlign()
  // из данных Strapi, чтобы логика была в одном месте и одинаково работала
  // и для сгенерированных баннеров, и для статичного hero из HTML.
  //
  // <video> присутствует всегда, но по умолчанию hidden — включает его
  // applyVideo(), только если в слоте реально есть видео. Порядок элементов
  // важен: картинка задаёт высоту баннера, видео лежит поверх неё абсолютом,
  // блок с текстом идёт последним и оказывается выше обоих.
  return `
    <img class="banner__image" src="" alt="banner" loading="lazy">
    <video class="banner__video" muted loop playsinline webkit-playsinline disablepictureinpicture preload="none" hidden>
      <source>
    </video>
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
 * Заполняет один слот (медиа, текст, кнопка, выравнивание, клик)
 * данными из Strapi.
 * slotEl — это либо весь баннер целиком (не split), либо .banner__half (split).
 * mediaEntry — запись из mediaRegistry: { imgEl, videoEl, data, slug, isPriority }.
 */
function updateSlot(slotEl, mediaEntry, slotData) {
  const lang = getLanguage()

  applySlotMedia(mediaEntry)

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
    // Таймер — сразу под заголовком, до subheading. countdown_until задаётся
    // в Strapi (дата и время выхода коллекции); если поле пустое — блок
    // просто не добавляется в разметку.
    if (slotData.countdown_until) parts.push(countdownHTML(lang))
    if (subheading) parts.push(`<p class="banner__subheading">${subheading}</p>`)
    textWrap.innerHTML = parts.join("")
    textWrap.style.display = parts.length ? "" : "none"

    // Разметка таймера уже в DOM (если была добавлена выше) — теперь можно
    // считать значения и запустить тикающий setInterval.
    setupCountdown(content, slotData, lang)
  }

  // content_align — горизонтальное выравнивание текстового блока и кнопки
  // внутри слота, настраивается в Strapi отдельно для каждого слота
  // (у split-баннера левая и правая половины независимы).
  // По вертикали блок всегда внизу — это зашито в CSS.
  applyContentAlign(content, slotData)

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
  // Ни кнопка, ни видео своих обработчиков не имеют — они внутри кликабельной
  // области слота, клик по ним всплывает к тому же обработчику.
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
      `/.netlify/functions/get-products?collection=${collectionSlug}&context=banner`
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