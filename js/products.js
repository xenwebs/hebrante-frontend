import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// 🔧 Общая функция маппинга товаров (чтобы не дублировать код)
function mapProducts(items, lang) {
  return items.map(item => {
    const imageUrl  = item.images?.[0]?.url || ""
    const imageUrl2 = item.images?.[1]?.url || ""   // ✅ вторая картинка для hover

    return {
      title: lang === 'en' ? (item.title_en || item.title) : item.title,
      price: item.price,
      formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
      slug: item.slug,
      image: imageUrl,
      imageWebP: imageUrl.replace(/\.jpg$/, ".webp"),
      image2: imageUrl2,                                // ✅
      imageWebP2: imageUrl2.replace(/\.jpg$/, ".webp"), // ✅
      collectionSlug: item.collection?.slug,
      collectionTitle: item.collection?.title
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

    grid.innerHTML = products.map(productCard).join("")

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

    grid.innerHTML = products.map(productCard).join("")

    console.log(`✅ Продукты Basics рендерены: ${products.length}`)

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
}