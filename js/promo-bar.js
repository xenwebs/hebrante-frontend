import { getLanguage } from "./lang.js"

/**
 * Промо-полоса на главной странице.
 * Текст (до 4 слотов), цвет фона и прозрачность редактируются клиентом
 * в Strapi (Collection Type "promo-bars" — используем только первую запись).
 * Блок обычный, в потоке документа — НЕ fixed/sticky, скроллится
 * вместе с остальным контентом.
 *
 * Если заполнено больше одного текстового слота — тексты сменяют
 * друг друга по кругу с мягким fade (не sliding, как в референсе клиента,
 * решили сделать проще и спокойнее визуально).
 *
 * Плейсхолдер `[data-promo-bar]` уже лежит в index.html первым
 * элементом внутри <main>, сразу под фиксированным хедером —
 * там подхватывается padding-top: var(--header-height) от main,
 * поэтому доп. отступы не нужны.
 */

// Сколько текст висит на экране, прежде чем смениться (мс)
const ROTATION_INTERVAL = 6000
// ВАЖНО: должно совпадать с transition в CSS у .promo-bar__text
const FADE_DURATION = 400

let rotationTimer = null

function hexToRgba(hex, opacity = 1) {
  if (!hex) return `rgba(30, 17, 13, ${opacity})`

  const clean = hex.replace("#", "").trim()
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean

  const bigint = parseInt(full, 16)
  if (Number.isNaN(bigint)) return `rgba(30, 17, 13, ${opacity})`

  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

  const safeOpacity = Math.min(Math.max(Number(opacity) || 0, 0), 1)
  return `rgba(${r}, ${g}, ${b}, ${safeOpacity})`
}

/**
 * Собирает непустые тексты из 4 слотов, с учётом языка.
 * Если для слота нет перевода на en — используется испанский текст (фоллбэк).
 */
function collectTexts(data, lang) {
  const slots = [
    [data.text, data.text_en],
    [data.text_2, data.text_2_en],
    [data.text_3, data.text_3_en],
    [data.text_4, data.text_4_en],
  ]

  return slots
    .map(([es, en]) => (lang === "en" ? (en || es) : es))
    .filter(Boolean)
}

export async function renderPromoBar() {
  const el = document.querySelector("[data-promo-bar]")
  const textEl = el?.querySelector("[data-promo-bar-text]")
  if (!el || !textEl) return

  // На случай повторного вызова renderPromoBar — не плодим интервалы
  if (rotationTimer) {
    clearInterval(rotationTimer)
    rotationTimer = null
  }

  try {
    const res = await fetch("/.netlify/functions/get-promo-bar")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    // Collection type — данные приходят массивом, берём первую запись
    const data = json?.data?.[0]

    // Записи нет вообще, или клиент выключил блок галочкой is_active в Strapi
    if (!data || data.is_active === false) {
      el.hidden = true
      return
    }

    const lang = getLanguage()
    const texts = collectTexts(data, lang)

    // Ни один слот не заполнен — блок нечего показывать
    if (!texts.length) {
      el.hidden = true
      return
    }

    const opacity = typeof data.opacity === "number" ? data.opacity : 1
    el.style.backgroundColor = hexToRgba(data.background_color, opacity)
    el.classList.toggle("promo-bar--light", Boolean(data.light_text))

    let index = 0
    textEl.textContent = texts[index]
    el.hidden = false

    // Ротация имеет смысл только если заполнено больше одного слота
    if (texts.length > 1) {
      rotationTimer = setInterval(() => {
        textEl.classList.add("promo-bar__text--fade")
        setTimeout(() => {
          index = (index + 1) % texts.length
          textEl.textContent = texts[index]
          textEl.classList.remove("promo-bar__text--fade")
        }, FADE_DURATION)
      }, ROTATION_INTERVAL)
    }
  } catch (error) {
    console.error("❌ Ошибка загрузки промо-полосы:", error)
    el.hidden = true
  }
}