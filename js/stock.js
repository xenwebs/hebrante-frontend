// 🔧 Единый источник правды о наличии товара.
//
// Раньше функция isProductSoldOut() жила внутри js/product.js и была доступна
// только странице товара. Теперь она вынесена сюда, чтобы карточка каталога
// (components/product-card.js) считала «распродано» ровно по тем же правилам.
// Если логика остатков когда-нибудь поменяется — правим только этот файл.

const SIZES = ['xs', 's', 'm', 'l', 'xl']
const ONESIZE_KEY = 'xxs'   // у onesize-товаров остаток лежит в поле xxs

// ✅ Есть ли у объекта товара данные об остатках вообще?
//
// Это защита от ложного «Agotado». Каталог получает товары через
// Netlify-функцию get-products, и если она не отдаёт stock_by_size,
// строгая проверка увидела бы «все размеры = 0» и повесила бейджик
// «Agotado» на ВЕСЬ каталог. Поэтому: нет данных → считаем, что не знаем.
export function hasStockData(product) {
  const stock = product?.stock_by_size
  if (!stock || typeof stock !== 'object') return false

  const keys = product?.onesize ? [ONESIZE_KEY] : SIZES
  return keys.some(key => stock[key] !== undefined && stock[key] !== null)
}

// ✅ Строгая проверка: товар полностью распродан?
// onesize → смотрим поле xxs, многоразмерный → все размеры должны быть <= 0.
// Поведение то же, что было в product.js: нет данных → распродан.
// Использовать там, где данные гарантированно есть (страница товара, populate=*).
export function isProductSoldOut(product) {
  if (product?.onesize) {
    return Number(product.stock_by_size?.[ONESIZE_KEY] || 0) <= 0
  }
  return SIZES.every(size => Number(product?.stock_by_size?.[size] || 0) <= 0)
}

// ✅ Безопасная проверка для карточек каталога.
// Если остатков в объекте нет — бейдж не показываем (лучше не показать
// «Agotado» на доступном товаре, чем показать его на всём каталоге).
export function isSoldOutForCard(product) {
  if (!hasStockData(product)) return false
  return isProductSoldOut(product)
}