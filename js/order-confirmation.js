// js/order-confirmation.js
//
// ⚠️ Статус платежа (orderStatus, paymentId, paymentMethod, paidAt, paymentDetails)
//    пишет ВЕБХУК Bold на бэкенде. Эта страница только читает заказ из Strapi
//    по order_id (documentId) и показывает его + шлёт Purchase в Meta Pixel.

import { getCart, clearCart } from "./cart.js"
import { loadTranslations, getTranslation } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// Вебхук Bold может прийти на пару секунд позже, чем покупателя вернуло
// на эту страницу. Пока статус "pending" — тихо перезапрашиваем заказ.
const STATUS_POLL_ATTEMPTS = 6
const STATUS_POLL_DELAY = 2500

// Формат сумм оставляем es-CO на всех языках — так же, как в корзине
// и на чекауте, чтобы цифры везде выглядели одинаково.
const money = new Intl.NumberFormat("es-CO")

const SHIPPING_KEYS = {
  standard: "oc_shipping_standard",
  express: "oc_shipping_express"
}

const STATUS_MAP = {
  paid:      { key: "oc_status_paid",      modifier: "paid" },
  pending:   { key: "oc_status_pending",   modifier: "pending" },
  failed:    { key: "oc_status_failed",    modifier: "failed" },
  cancelled: { key: "oc_status_cancelled", modifier: "failed" },
  refunded:  { key: "oc_status_refunded",  modifier: "failed" }
}

// Последнее отрисованное состояние — чтобы перерисовать страницу
// при смене языка, не запрашивая заказ заново
let lastState = null

// ==================== INIT ====================

document.addEventListener("DOMContentLoaded", async () => {
  // main.js вызывает initLanguage() параллельно с нами, поэтому переводы
  // могли ещё не загрузиться. Дожидаемся их сами — loadTranslations пишет
  // в общий модуль lang.js, повторный вызов безопасен.
  await loadTranslations(currentLang())

  const orderId = new URLSearchParams(window.location.search).get("order_id")

  if (!orderId) {
    lastState = { type: "error", messageKey: "oc_error_no_id" }
    renderState()
    return
  }

  console.log("✅ Procesando confirmación de pedido:", orderId)

  // Снимок корзины до очистки — запасной вариант, если Strapi не ответит
  const cartSnapshot = getCart()

  try {
    const order = await fetchOrder(orderId)

    // Корзину чистим только когда точно знаем, что заказ существует
    clearCart()

    lastState = { type: "order", order, orderId }
    renderState()
    firePurchase(orderId, order.items || [], order.total)

    // Если вебхук ещё не проставил "paid" — дожидаемся его в фоне
    if (order.orderStatus === "pending") {
      pollStatus(orderId)
    }

  } catch (error) {
    console.error("❌ Error al cargar el pedido:", error)

    // Заказ создан и оплачен, просто не смогли его прочитать —
    // показываем то, что знаем, чтобы человек не думал, что деньги пропали
    if (cartSnapshot.length) {
      clearCart()
      lastState = { type: "fallback", items: cartSnapshot, orderId }
      renderState()
      firePurchase(orderId, cartSnapshot)
    } else {
      lastState = { type: "error", messageKey: "oc_error_load", orderId }
      renderState()
    }
  }
})

// Смена языка в шапке — перерисовываем уже загруженный заказ
document.addEventListener("languageChanged", () => {
  if (lastState) renderState()
})

// ==================== ДАННЫЕ ====================

async function fetchOrder(orderId) {
  const response = await fetch(`${API_URL}/api/orders/${orderId}`)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const json = await response.json()
  const order = json.data

  if (!order) throw new Error("Pedido no encontrado")

  return order
}

async function pollStatus(orderId) {
  for (let attempt = 1; attempt <= STATUS_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, STATUS_POLL_DELAY))

    try {
      const order = await fetchOrder(orderId)

      if (order.orderStatus !== "pending") {
        console.log(`✅ Estado actualizado por el webhook: ${order.orderStatus}`)
        lastState = { type: "order", order, orderId }
        renderState()
        return
      }
    } catch (error) {
      console.warn(`⚠️ Reintento ${attempt} falló:`, error.message)
    }
  }

  console.log("ℹ️ El webhook aún no confirma el pago; se muestra 'Verificando pago'")
}

// ==================== RENDER ====================

function renderState() {
  if (!lastState) return

  if (lastState.type === "order") {
    renderOrder(lastState.order, lastState.orderId)
  } else if (lastState.type === "fallback") {
    renderFallback(lastState.orderId, lastState.items)
  } else {
    renderError(lastState.messageKey, lastState.orderId)
  }
}

function renderOrder(order, orderId) {
  const container = document.getElementById("order-confirmation")
  if (!container) return

  const status = STATUS_MAP[order.orderStatus] || STATUS_MAP.pending
  const isPaid = order.orderStatus === "paid"

  const dateSource = order.paidAt || order.createdAt
  const date = dateSource ? formatDate(dateSource) : "—"

  const customerName = [order.firstName, order.lastName].filter(Boolean).join(" ")

  const addressLines = [
    customerName,
    [order.street, order.apartment].filter(Boolean).join(", "),
    [order.city, order.state, order.zip].filter(Boolean).join(", "),
    "Colombia"
  ].filter(Boolean)

  const contactLines = [order.phone, order.email].filter(Boolean)

  const items = Array.isArray(order.items) ? order.items : []

  const shippingLabel = t(SHIPPING_KEYS[order.shippingMethod] || "shipping")
  const shippingCost = Number(order.shippingCost) || 0
  const discount = Number(order.discount) || 0

  container.innerHTML = `
    <div class="confirmation__head">
      <h1 class="h1">${t(isPaid ? "oc_title_confirmed" : "oc_title_received")}</h1>
      <p class="t2 confirmation__intro">
        ${t(isPaid ? "oc_intro_confirmed" : "oc_intro_pending")}
      </p>
    </div>

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_order_number")}</p>
      <div class="confirmation__order-id">
        <p class="t2 confirmation__value">#${escapeHtml(String(orderId).toUpperCase())}</p>
        <button type="button" class="confirmation__copy" id="copy-order-id" data-order-id="${escapeHtml(String(orderId))}">${t("oc_copy")}</button>
      </div>
    </div>

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_date")}</p>
      <p class="t2 confirmation__value">${escapeHtml(date)}</p>
    </div>

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_status")}</p>
      <div class="confirmation__status confirmation__status--${status.modifier}">
        <span class="confirmation__status-dot"></span>
        <p class="t2 confirmation__value">${t(status.key)}</p>
      </div>
    </div>

    ${order.paymentMethod || order.paymentId ? `
      <div class="confirmation__block">
        <p class="t3 confirmation__label">${t("oc_payment")}</p>
        ${order.paymentMethod ? `<p class="t2 confirmation__value">${escapeHtml(order.paymentMethod)}</p>` : ""}
        ${order.paymentId ? `<p class="t3 confirmation__label">${t("oc_transaction_id")}: ${escapeHtml(order.paymentId)}</p>` : ""}
      </div>
    ` : ""}

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_shipping_details")}</p>
      ${addressLines.map(line => `<p class="t2 confirmation__value">${escapeHtml(line)}</p>`).join("")}
      ${contactLines.length ? `<p class="t3 confirmation__label">${contactLines.map(escapeHtml).join(" · ")}</p>` : ""}
      <p class="t3 confirmation__label">${shippingLabel}</p>
    </div>

    ${order.trackingNumber ? `
      <div class="confirmation__block">
        <p class="t3 confirmation__label">${t("oc_tracking")}</p>
        <p class="t2 confirmation__value">${escapeHtml([order.shippingCarrier, order.trackingNumber].filter(Boolean).join(" · "))}</p>
      </div>
    ` : ""}

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_products")}</p>
      <div class="confirmation__items">
        ${items.map(renderItem).join("")}
      </div>
    </div>

    <div class="confirmation__totals">
      <div class="confirmation__row confirmation__row--muted">
        <span class="t2">${t("oc_subtotal")}</span>
        <span class="t2">$${money.format(Number(order.subtotal) || 0)}</span>
      </div>

      ${discount > 0 ? `
        <div class="confirmation__row confirmation__row--discount">
          <span class="t2">${t("oc_discount")}${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ""}</span>
          <span class="t2">−$${money.format(discount)}</span>
        </div>
      ` : ""}

      <div class="confirmation__row confirmation__row--muted">
        <span class="t2">${shippingLabel}</span>
        <span class="t2">${shippingCost === 0 ? t("oc_free") : `$${money.format(shippingCost)}`}</span>
      </div>

      <div class="confirmation__row confirmation__row--total">
        <span class="h3">${t("oc_total")}</span>
        <span class="h3">$${money.format(Number(order.total) || 0)}</span>
      </div>
    </div>

    <p class="t3 confirmation__label">
      ${t("oc_email_note", { email: order.email ? escapeHtml(order.email) : t("oc_your_email") })}
    </p>

    <div class="confirmation__actions">
      <a href="/" class="confirmation__btn">${t("oc_back_to_shop")}</a>
      <div class="confirmation__links">
        <button type="button" class="confirmation__link" id="print-order">${t("oc_print")}</button>
        <a href="/pages/refund-policy.html" class="confirmation__link">${t("nav_return_policy")}</a>
      </div>
    </div>
  `

  bindActions()
}

function renderItem(item) {
  const quantity = Number(item.quantity) || 1
  const price = Number(item.price) || 0
  const lineTotal = price * quantity

  return `
    <div class="confirmation-item">
      ${item.image
        ? `<img class="confirmation-item__image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || "")}" loading="lazy">`
        : `<div class="confirmation-item__image"></div>`}
      <div class="confirmation-item__details">
        <div class="confirmation-item__info">
          <p class="t2">${escapeHtml(item.title || t("oc_product"))}</p>
          <p class="t3 confirmation__label">${t("size")}: ${escapeHtml(String(item.size || "—").toUpperCase())}</p>
          ${quantity > 1 ? `<p class="t3 confirmation__label">${t("oc_quantity")}: ${quantity}</p>` : ""}
        </div>
        <p class="t2 confirmation-item__price">$${money.format(lineTotal)}</p>
      </div>
    </div>
  `
}

// Запасной рендер: заказ оплачен, но Strapi не ответил.
// Показываем номер + товары из снимка корзины, без адреса и итогов из базы.
function renderFallback(orderId, items) {
  const container = document.getElementById("order-confirmation")
  if (!container) return

  const total =
    Number(localStorage.getItem("lastOrderTotal")) ||
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  container.innerHTML = `
    <div class="confirmation__head">
      <h1 class="h1">${t("oc_title_received")}</h1>
      <p class="t2 confirmation__intro">${t("oc_intro_fallback")}</p>
    </div>

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_order_number")}</p>
      <div class="confirmation__order-id">
        <p class="t2 confirmation__value">#${escapeHtml(String(orderId).toUpperCase())}</p>
        <button type="button" class="confirmation__copy" id="copy-order-id" data-order-id="${escapeHtml(String(orderId))}">${t("oc_copy")}</button>
      </div>
    </div>

    <div class="confirmation__block">
      <p class="t3 confirmation__label">${t("oc_products")}</p>
      <div class="confirmation__items">
        ${items.map(renderItem).join("")}
      </div>
    </div>

    <div class="confirmation__totals">
      <div class="confirmation__row confirmation__row--total">
        <span class="h3">${t("oc_total")}</span>
        <span class="h3">$${money.format(total)}</span>
      </div>
    </div>

    <p class="t3 confirmation__label">${t("oc_email_note", { email: t("oc_your_email") })}</p>

    <div class="confirmation__actions">
      <a href="/" class="confirmation__btn">${t("oc_back_to_shop")}</a>
    </div>
  `

  bindActions()
}

function renderError(messageKey, orderId) {
  const container = document.getElementById("order-confirmation")
  if (!container) return

  container.innerHTML = `
    <div class="confirmation__head">
      <h1 class="h1">${t("oc_title_error")}</h1>
      <p class="t2 confirmation__intro">${t(messageKey)}</p>
    </div>

    ${orderId ? `
      <div class="confirmation__block">
        <p class="t3 confirmation__label">${t("oc_order_number")}</p>
        <p class="t2 confirmation__value">#${escapeHtml(String(orderId).toUpperCase())}</p>
      </div>
    ` : ""}

    <p class="t3 confirmation__error-note">${t("oc_error_note")}</p>

    <div class="confirmation__actions">
      <a href="/" class="confirmation__btn">${t("oc_back_to_shop")}</a>
    </div>
  `
}

// ==================== ДЕЙСТВИЯ ====================

function bindActions() {
  const copyBtn = document.getElementById("copy-order-id")
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.orderId)
        copyBtn.textContent = t("oc_copied")
        setTimeout(() => { copyBtn.textContent = t("oc_copy") }, 2000)
      } catch (error) {
        console.warn("No se pudo copiar:", error)
      }
    })
  }

  const printBtn = document.getElementById("print-order")
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print())
  }
}

// ==================== META PIXEL ====================

function firePurchase(orderId, items, orderTotal) {
  if (typeof fbq === "undefined") {
    console.warn("⚠️ Meta Pixel (fbq) no está cargado en esta página")
    return
  }

  // Защита от повторной отправки при перезагрузке страницы
  const firedKey = `purchase_fired_${orderId}`
  if (sessionStorage.getItem(firedKey)) {
    console.log("ℹ️ Purchase ya enviado para este pedido")
    return
  }

  const total =
    Number(orderTotal) ||
    Number(localStorage.getItem("lastOrderTotal")) ||
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  fbq("track", "Purchase", {
    value: total,
    currency: "COP",
    content_type: "product",
    content_ids: items.map(item => String(item.id)),
    contents: items.map(item => ({
      id: String(item.id),
      quantity: item.quantity,
      item_price: item.price
    })),
    num_items: items.reduce((n, item) => n + (Number(item.quantity) || 1), 0)
  })

  sessionStorage.setItem(firedKey, "1")
  console.log("✅ Purchase enviado a Meta Pixel (value:", total, ")")
}

// ==================== УТИЛИТЫ ====================

function currentLang() {
  return localStorage.getItem("language") || "es"
}

// Обёртка над getTranslation с подстановкой переменных: t("key", { email: "..." })
function t(key, vars) {
  let text = getTranslation(key)

  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, value)
    })
  }

  return text
}

function formatDate(value) {
  const date = new Date(value)
  if (isNaN(date)) return "—"

  // Берём язык из localStorage, а не из getLanguage(): main.js мог ещё
  // не успеть выставить currentLanguage к моменту первого рендера.
  const locale = currentLang() === "en" ? "en-US" : "es-CO"

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}