import { getLanguage } from "../js/lang.js"
import { getPriceView } from "../js/price.js"
import { isSoldOutForCard } from "../js/stock.js"   // ✅ та же логика, что на странице товара

export function productCard(product, index = 0) {
  // Первые 6 карточек — это первый экран, грузим сразу без lazy
  const isAboveFold = index < 6
  const mainLoading = isAboveFold ? "eager" : "lazy"

  const lang = getLanguage()

  // ✅ Распродан ли товар.
  // Безопасная версия: если в объекте нет stock_by_size (например, Netlify-функция
  // его не отдала) — бейдж просто не появится, вместо «Agotado» на всём каталоге.
  const soldOut = isSoldOutForCard(product)
  const soldOutText = lang === 'en' ? 'Sold out' : 'Agotado'

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

  // ✅ Приоритет бейджей: «Agotado» важнее скидки.
  // Показывать «-30% OFF» на товаре, который нельзя купить, — только злить покупателя.
  const badgeHTML = soldOut
    ? `<span class="product-card__badge product-card__badge--sold-out">${soldOutText}</span>`
    : price.discounted
      ? `<span class="product-card__badge">${price.percent}% OFF</span>`
      : ""

  const priceHTML = price.discounted
    ? `<p class="product-card__price product-card__price--sale">
         <span class="product-card__price-new">$${price.finalFormatted}</span>
         <span class="product-card__price-old">$${price.baseFormatted}</span>
       </p>`
    : `<p class="product-card__price">$${product.formattedPrice}</p>`

  // Карточка остаётся кликабельной: на странице товара человек увидит описание,
  // размеры и сможет вернуться, когда товар появится.
  return `
    <a href="/pages/product.html?slug=${product.slug}" class="product-card${soldOut ? ' product-card--sold-out' : ''}">
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