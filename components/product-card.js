import { getLanguage } from "../js/lang.js"
import { getPriceView } from "../js/price.js"   // ✅ новый импорт

export function productCard(product, index = 0) {
  // Первые 6 карточек — это первый экран, грузим сразу без lazy
  const isAboveFold = index < 6
  const mainLoading = isAboveFold ? "eager" : "lazy"

  const hasHoverImage = product.image2 && product.image2 !== product.image

  const hoverImageHTML = hasHoverImage
    ? `<img
         src="${product.image2}"
         class="product-card__image product-card__image--hover"
         alt="${product.title}"
         loading="lazy"
         decoding="async">`
    : ""

  const price = getPriceView(product)

  const badgeHTML = price.discounted
    ? `<span class="product-card__badge">${price.percent}% OFF</span>`
    : ""

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
          loading="${mainLoading}"
          decoding="async">
        ${hoverImageHTML}
      </div>

      <div class="product-card__text">
        <p class="product-card__title">${product.title}</p>
        ${priceHTML}
      </div>
    </a>
  `
}