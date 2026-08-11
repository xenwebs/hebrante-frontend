import { getLanguage } from "./lang.js"

/**
 * Промо-полоса на главной странице.
 * Текст, цвет фона и прозрачность редактируются клиентом в Strapi
 * (Collection Type "promo-bars" — используем только первую запись).
 * Блок обычный, в потоке документа — НЕ fixed/sticky, скроллится
 * вместе с остальным контентом.
 *
 * Плейсхолдер `[data-promo-bar]` уже лежит в index.html первым
 * элементом внутри <main>, сразу под фиксированным хедером —
 * там подхватывается padding-top: var(--header-height) от main,
 * поэтому доп. отступы не нужны.
 */

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

export async function renderPromoBar() {
  const el = document.querySelector("[data-promo-bar]")
  if (!el) return

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
    const text = lang === "en"
      ? (data.text_en || data.text || "")
      : (data.text || "")

    // Пустой текст — блок нечего показывать
    if (!text) {
      el.hidden = true
      return
    }

    const opacity = typeof data.opacity === "number" ? data.opacity : 1
    el.style.backgroundColor = hexToRgba(data.background_color, opacity)
    el.classList.toggle("promo-bar--light", Boolean(data.light_text))
    el.textContent = text
    el.hidden = false
  } catch (error) {
    console.error("❌ Ошибка загрузки промо-полосы:", error)
    el.hidden = true
  }
}