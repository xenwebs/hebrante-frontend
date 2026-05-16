import { getLanguage } from "../js/lang.js"

export function productCard(product){
  return `
    <a href="/pages/product.html?slug=${product.slug}" class="product-card">
      <img src="${product.image}" class="product-card__image">

      <div class="product-card__text">
        <p class="product-card__title">${product.title}</p>
        <p class="product-card__price">$${product.formattedPrice}</p>
      </div>
    </a>
  `
}