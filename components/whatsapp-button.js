/**
 * WhatsApp floating button — HEBRANTE
 *
 * Подключение — через main.js (ES-модуль):
 *   import { initWhatsAppButton } from "./whatsapp-button.js"
 *   initWhatsAppButton()
 *
 * Стили: whatsapp-button.css (или тот же код в конце layout.css)
 *
 * Отключить точечно:   <body data-whatsapp="off">
 * Управление из кода:   window.HebranteWhatsApp.hide() / .show()
 * Показ после прелоадера:
 *   window.dispatchEvent(new Event('preloader:done'))
 */

const CONFIG = {
  // Номер: код страны, без "+" и пробелов
  phone: '57XXXXXXXXXX',

  // Тексты по языкам
  text: {
    es: {
      msg: 'Hola HEBRANTE 👋',
      about: 'Quiero información sobre',
      aria: 'Escríbenos por WhatsApp'
    },
    en: {
      msg: 'Hi HEBRANTE 👋',
      about: 'I have a question about',
      aria: 'Message us on WhatsApp'
    }
  },

  // Не показывать вообще
  hideOn: [
    /^\/admin\//,          // админка (envios.html и т.д.)
    /\/(gracias|pago)/     // страница результата оплаты
  ],

  // Не показывать только на мобильном (перекрывает липкую кнопку оплаты)
  hideOnMobile: [
    /checkout/
  ],
  mobileQuery: '(max-width: 768px)',

  // Прятать, пока на <body> висит один из этих классов
  // (мини-корзина, бургер-меню, модалки) — ПОДСТАВЬ СВОИ ИМЕНА КЛАССОВ
  hideWhenBodyHas: ['menu-open', 'cart-open', 'modal-open', 'no-scroll'],

  // Запасная задержка показа, если события preloader:done не будет
  delay: 4000
}

const ICON = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>`

export function initWhatsAppButton() {
  const path = window.location.pathname

  if (window.HebranteWhatsApp) return                       // уже инициализирована
  if (document.body.dataset.whatsapp === 'off') return
  if (CONFIG.hideOn.some(re => re.test(path))) return

  const mq = window.matchMedia(CONFIG.mobileQuery)
  const mobileExcluded = CONFIG.hideOnMobile.some(re => re.test(path))

  /* ---------- язык ---------- */
  // initLanguage() из lang.js уже отработал к этому моменту
  function detectLang() {
    const html = (document.documentElement.lang || '').toLowerCase()
    if (html.startsWith('en')) return 'en'
    if (html.startsWith('es')) return 'es'
    const stored = (localStorage.getItem('lang') || localStorage.getItem('language') || '').toLowerCase()
    if (stored.startsWith('en')) return 'en'
    if (/^\/en(\/|$)/.test(path)) return 'en'
    return 'es'
  }

  /* ---------- ссылка ---------- */
  // Считаем href не при создании, а перед самым переходом: на product.html
  // товар приходит из Strapi асинхронно и в момент init его ещё нет в DOM.
  function buildHref() {
    const t = CONFIG.text[detectLang()]
    let message = t.msg

    const el = document.querySelector('[data-product-name]')
    if (el) {
      const name = (el.dataset.productName || el.textContent || '').trim()
      if (name) message = `${t.msg} ${t.about}: ${name} — ${window.location.href}`
    }

    return `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(message)}`
  }

  /* ---------- разметка ---------- */
  const link = document.createElement('a')
  link.className = 'wa-fab'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.innerHTML = ICON
  refreshHref()
  document.body.appendChild(link)

  function refreshHref() {
    link.href = buildHref()
    link.setAttribute('aria-label', CONFIG.text[detectLang()].aria)
  }

  // обновляем прямо перед переходом — язык мог смениться, товар дорисоваться
  link.addEventListener('pointerdown', refreshHref)
  link.addEventListener('focus', refreshHref)
  link.addEventListener('click', () => {
    refreshHref()
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'WhatsAppClick', { page: path })
    }
  })

  /* ---------- видимость ---------- */
  let revealed = false
  let manualHidden = false

  const bodyBlocks = () =>
    CONFIG.hideWhenBodyHas.some(c => document.body.classList.contains(c))

  function shouldShow() {
    if (!revealed || manualHidden) return false
    if (mobileExcluded && mq.matches) return false
    return !bodyBlocks()
  }

  function update() {
    link.classList.toggle('is-visible', shouldShow())
  }

  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', update)
  else if (typeof mq.addListener === 'function') mq.addListener(update)   // старые Safari

  new MutationObserver(update).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  })

  function reveal() {
    revealed = true
    update()
  }

  window.addEventListener('preloader:done', reveal, { once: true })
  setTimeout(reveal, CONFIG.delay)   // страховка, если событие не пришло

  /* ---------- публичный API ---------- */
  window.HebranteWhatsApp = {
    hide() { manualHidden = true; update() },
    show() { manualHidden = false; update() },
    refresh: refreshHref,
    el: link
  }
}