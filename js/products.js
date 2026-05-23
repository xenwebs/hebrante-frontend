import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

// ✅ Функция для главной (где баннеры)
export async function renderProducts(){
  try {
    const lang = getLanguage();
    const res = await fetch(`${API_URL}/api/products?populate=*`)
    const data = await res.json()

    // Просто загружай данные, но НЕ рендери на странице
    // Баннеры сами это сделают
    console.log("✅ Продукты загружены для баннеров")

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
}

// ✅ Функция для страницы "Все продукты"
export async function renderAllProducts(){
  try {
    const lang = getLanguage();
    const res = await fetch(`${API_URL}/api/products?populate=*`)
    const data = await res.json()

    const products = data.data.map(item => {
      const imageData = getImageWithWebP(item.images?.[0]?.url || "")
      
      return {
        title: lang === 'en' ? (item.title_en || item.title) : item.title,
        price: item.price,
        formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
        slug: item.slug,
        image: imageData.jpg,
        imageWebP: imageData.webp,
        collectionSlug: item.collection?.slug,
        collectionTitle: item.collection?.title
      }
    })

    const grids = document.querySelectorAll("[data-all-products]")  // ← querySelectAll!
    if (grids.length === 0) {
      console.warn("⚠️ Грид не найден")
      return
    }

    // Распредели продукты по грид (по 3 в каждый)
    grids.forEach((grid, index) => {
      const start = index * 3
      const end = start + 3
      const slicedProducts = products.slice(start, end)
      grid.innerHTML = slicedProducts.map(productCard).join("")
    })

    console.log("✅ Все продукты рендерены")

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
}

// ✅ Функция для рендера продуктов коллекции "Basics"
export async function renderBasicsProducts(){
  try {
    const lang = getLanguage();
    const res = await fetch(`${API_URL}/api/products?filters[collection][slug][$eq]=basics&populate=*`)
    const data = await res.json()

    const products = data.data.map(item => {
      const imageData = getImageWithWebP(item.images?.[0]?.url || "")
      
      return {
        title: lang === 'en' ? (item.title_en || item.title) : item.title,
        price: item.price,
        formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
        slug: item.slug,
        image: imageData.jpg,
        imageWebP: imageData.webp,
        collectionSlug: item.collection?.slug,
        collectionTitle: item.collection?.title
      }
    })

    const grids = document.querySelectorAll(".products-grid")
    if (grids.length === 0) {
      console.warn("⚠️ Грид не найден")
      return
    }

    // Распредели продукты по грид (по 2 в каждый)
    grids.forEach((grid, index) => {
      const start = index * 3
      const end = start + 3
      const slicedProducts = products.slice(start, end)
      grid.innerHTML = slicedProducts.map(productCard).join("")
    })

    console.log("✅ Все продукты рендерены")

  } catch (error) {
    console.error("Ошибка загрузки:", error)
  }
  
}