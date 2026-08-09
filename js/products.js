import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// 🔧 Выбираем подходящий размер из Strapi formats
// Порядок: medium (~750px) → large (~1000px) → small → оригинал
// Фоллбэк нужен потому, что Strapi создаёт формат только если
// оригинал шире соответствующего брейкпоинта.
function pickImageUrl(img) {
  if (!img) return ""
  const f = img.formats || {}
  return f.medium?.url || f.large?.url || f.small?.url || img.url || ""
}

// 🔧 Общая функция маппинга товаров (чтобы не дублировать код)
function mapProducts(items, lang) {
  return items.map(item => {
    const imageUrl  = pickImageUrl(item.images?.[0])
    const imageUrl2 = pickImageUrl(item.images?.[1])   // ✅ вторая картинка для hover

    return {
      title: lang === 'en' ? (item.title_en || item.title) : item.title,
      price: item.price,
      formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
      slug: item.slug,
      image: imageUrl,
      image2: imageUrl2,
      collectionSlug: item.collection?.slug,
      collectionTitle: item.collection?.title,
      discount_percent: item.discount_percent || 0      // ✅ скидка
    }
  })
}

// ✅ Функция для страницы "Все продукты"
export async function renderAllProducts(){
  try {
    const lang = getLanguage()
    const res = await fetch(`/.netlify/functions/get-products`)
    const data = await res.json()

    const products = mapProducts(data.data, lang)

    // Один грид на всю страницу — CSS сам разложит карточки по строкам
    const grid = document.querySelector("[data-all-products]")
    if (!grid) {
      console.warn("⚠️ Грид [data-all-products] не найден")
      return
    }

    // index попадает в productCard вторым аргументом —
    // первые карточки рендерятся с loading="eager"
    grid.innerHTML = products.map((p, i) => productCard(p, i)).join("")

    console.log(`✅ Все продукты рендерены: ${products.length}`)

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
}

// ✅ Функция для рендера продуктов коллекции "Basics"
export async function renderBasicsProducts(){
  try {
    const lang = getLanguage()
    const res = await fetch(`/.netlify/functions/get-products?collection=basics`)
    const data = await res.json()

    const products = mapProducts(data.data, lang)

    // Тоже один грид
    const grid = document.querySelector("[data-basics-products]")
    if (!grid) {
      console.warn("⚠️ Грид [data-basics-products] не найден")
      return
    }

    grid.innerHTML = products.map((p, i) => productCard(p, i)).join("")

    console.log(`✅ Продукты Basics рендерены: ${products.length}`)

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
}