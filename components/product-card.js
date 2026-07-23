import { getLanguage } from "../js/lang.js"
import { getPriceView } from "../js/price.js"   // ✅ новый импорт

export function productCard(product) {
  // Показываем hover-картинку только если она есть и отличается от основной
  const hasHoverImage = product.image2 && product.image2 !== product.image

  const hoverImageHTML = hasHoverImage
    ? `<img
         src="${product.image2}"
         class="product-card__image product-card__image--hover"
         alt="${product.title}"
         loading="lazy">`
    : ""

  // ✅ Расчёт цены со скидкой (единый источник правды — js/price.js)
  const price = getPriceView(product)

  // ✅ Бейдж со скидкой (лежит внутри .product-card__media)
  const badgeHTML = price.discounted
    ? `<span class="product-card__badge">${price.percent}% OFF</span>`
    : ""

  // ✅ Блок цены: старая перечёркнутая + новая, либо обычная
  const priceHTML = price.discounted
    ? `<p class="product-card__price product-card__price--sale">
         <span class="product-card__price-new">$${price.finalFormatted}</span>
         <span class="product-card__price-old">$${price.baseFormatted}</span>
       </p>`
    : `<p class="product-card__price">$${product.formattedPrice}</p>`
  return `
    <a href="/pages/product.html?slug=${product.slug}" class="product-card">
      <div class="product-card__media">
        ${badgeHTML}
        <img
          src="${product.image}"
          class="product-card__image product-card__image--main"
          alt="${product.title}"
          loading="lazy">
        ${hoverImageHTML}
      </div>

      <div class="product-card__text">
        <p class="product-card__title">${product.title}</p>
        ${priceHTML}
      </div>
    </a>
  `
}