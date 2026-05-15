import { productCard } from "../components/product-card.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

export function collectionCard(collection) {
    return `
    <a href="javascript:void(0)" onclick="window.location.href='/pages/collection.html?slug=${collection.slug}'" class="collection-card">
        <img src="${collection.image}" alt="${collection.title}" />
        <p class="t1">${collection.title}</p>
    </a>
    `
}

export async function renderCollections() {
  try {
    const res = await fetch(`${API_URL}/api/collections?populate=*`)
    const data = await res.json()

    console.log("📦 Collections data:", data)

    const collections = data.data.map(item => ({
      title: item.name,
      slug: item.slug,
      image: item.cover?.url
        ? item.cover.url
        : ""
    }))

    const grid = document.querySelector(".collections-grid")
    if (!grid) {
      console.error("❌ Grid контейнер не найден")
      return
    }

    grid.innerHTML = collections.map(collectionCard).join("")
    console.log("✅ Collections рендерены!")

  } catch (error) {
    console.error("❌ Ошибка загрузки коллекций:", error)
  }
}

// ✅ ФУНКЦИЯ для рендера баннера (ВЫНЕСЕНА НАРУЖУ)
function renderCollectionBanner(collection) {
  const bannerEl = document.getElementById("collection-banner")
  if (!bannerEl) {
    console.warn("⚠️ Баннер контейнер не найден")
    return
  }

  // Получи картинки
  const banner1x = collection.banner?.url
    ? collection.banner.url
    : ""
  
  const banner2x = collection.banner2x?.url
    ? collection.banner2x.url
    : banner1x  // fallback на 1x если 2x нет

  console.log("🖼️ Banner 1x:", banner1x)
  console.log("🖼️ Banner 2x:", banner2x)

  // Обнови картинку
  const img = bannerEl.querySelector(".banner__image")
  if (img && banner1x) {
    img.src = banner1x
    img.srcset = `${banner1x} 1x, ${banner2x} 2x`
    console.log("✅ Баннер коллекции рендерен!")
  } else if (!banner1x) {
    console.warn("⚠️ Нет картинки баннера в Strapi")
  }
}

// ✅ НОВАЯ ФУНКЦИЯ для отображения одной коллекции
export async function renderCollectionDetail() {
  try {
    // Получи slug из URL
    const urlParams = new URLSearchParams(window.location.search)
    const slug = urlParams.get("slug")

    if (!slug) {
      console.error("❌ Slug не найден в URL")
      return
    }

    console.log("🔍 Загружаю коллекцию:", slug)

    // Получи данные коллекции по slug
    const res = await fetch(`${API_URL}/api/collections?filters[slug][$eq]=${slug}&populate=*`)
    const data = await res.json()

    if (!data.data || data.data.length === 0) {
      console.error("❌ Коллекция не найдена")
      return
    }

    const collection = data.data[0]
    console.log("✅ Коллекция загружена:", collection)

    // ✅ РЕНДЕРИ БАННЕР
    renderCollectionBanner(collection)

    // Обнови заголовок
    const title = document.querySelector(".h1")
    if (title) {
      title.textContent = collection.name
    }

    // Загрузи продукты этой коллекции
    const productsRes = await fetch(
      `${API_URL}/api/products?filters[collection][slug][$eq]=${slug}&populate=*`
    )
    const productsData = await productsRes.json()

    console.log("📦 Продукты:", productsData.data)

    // Рендери продукты
    const productsGrid = document.querySelector(".products-grid")
    if (productsGrid && productsData.data) {
      const products = productsData.data.map(item => ({
        title: item.title,
        price: item.price,
        formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
        slug: item.slug,
        image: item.images?.[0]?.url
          ? item.images[0].url
          : "",
        collectionSlug: item.collection?.slug,
        collectionTitle: item.collection?.title
      }))
      
      productsGrid.innerHTML = products.map(productCard).join("")
      console.log("✅ Продукты рендерены!")
    }

  } catch (error) {
    console.error("❌ Ошибка загрузки деталей коллекции:", error)
  }
}