import { getLanguage } from "../js/lang.js"

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

  return `
    <a href="/pages/product.html?slug=${product.slug}" class="product-card">
      <div class="product-card__media">
        <img
          src="${product.image}"
          class="product-card__image product-card__image--main"
          alt="${product.title}"
          loading="lazy">
        ${hoverImageHTML}
      </div>

      <div class="product-card__text">
        <p class="product-card__title">${product.title}</p>
        <p class="product-card__price">$${product.formattedPrice}</p>
      </div>
    </a>
  `
}