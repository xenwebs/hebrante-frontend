import { productCard } from "../components/product-card.js"
import { getLanguage } from "./lang.js"

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
    const lang = getLanguage()
    const res = await fetch(`${API_URL}/api/collections?populate=*`)
    const data = await res.json()

    console.log("📦 Collections data:", data)

    const collections = data.data.map(item => ({
      // ✅ перевод названия коллекции на карточках collections.html
      title: lang === 'en' ? (item.name_en || item.name) : item.name,
      slug: item.slug,
      image: item.cover?.url ? item.cover.url : ""
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

function renderCollectionBanner(collection) {
  const bannerEl = document.getElementById("collection-banner")
  if (!bannerEl) {
    console.warn("⚠️ Баннер контейнер не найден")
    return
  }

  const banner1x = collection.banner?.url ? collection.banner.url : ""
  const banner2x = collection.banner2x?.url ? collection.banner2x.url : banner1x

  console.log("🖼️ Banner 1x:", banner1x)
  console.log("🖼️ Banner 2x:", banner2x)

  const img = bannerEl.querySelector(".banner__image")
  if (img && banner1x) {
    img.src = banner1x
    img.srcset = `${banner1x} 1x, ${banner2x} 2x`
    console.log("✅ Баннер коллекции рендерен!")
  } else if (!banner1x) {
    console.warn("⚠️ Нет картинки баннера в Strapi")
  }
}

export async function renderCollectionDetail() {
  try {
    const lang = getLanguage()

    const urlParams = new URLSearchParams(window.location.search)
    const slug = urlParams.get("slug")

    if (!slug) {
      console.error("❌ Slug не найден в URL")
      return
    }

    console.log("🔍 Загружаю коллекцию:", slug)

    const res = await fetch(`${API_URL}/api/collections?filters[slug][$eq]=${slug}&populate=*`)
    const data = await res.json()

    if (!data.data || data.data.length === 0) {
      console.error("❌ Коллекция не найдена")
      return
    }

    const collection = data.data[0]
    console.log("✅ Коллекция загружена:", collection)

    renderCollectionBanner(collection)

    // ✅ перевод заголовка коллекции на collection.html
    const title = document.querySelector(".h1")
    if (title) {
      title.textContent = lang === 'en' ? (collection.name_en || collection.name) : collection.name
    }

    const productsRes = await fetch(
      `${API_URL}/api/products?filters[collection][slug][$eq]=${slug}&populate=*`
    )
    const productsData = await productsRes.json()

    console.log("📦 Продукты:", productsData.data)

    const firstGrid = document.querySelector(".products-grid")

    if (firstGrid && productsData.data) {
      const products = productsData.data.map(item => {
        const imageUrl  = item.images?.[0]?.url || ""
        const imageUrl2 = item.images?.[1]?.url || ""   // ✅ вторая картинка для hover

        return {
          // ✅ перевод названий продуктов внутри коллекции
          title: lang === 'en' ? (item.title_en || item.title) : item.title,
          price: item.price,
          formattedPrice: new Intl.NumberFormat("es-CO").format(item.price),
          slug: item.slug,
          image: imageUrl,
          imageWebP: imageUrl.replace(/\.jpg$/, ".webp"),
          image2: imageUrl2,                                // ✅
          imageWebP2: imageUrl2.replace(/\.jpg$/, ".webp"), // ✅
          collectionSlug: item.collection?.slug,
          collectionTitle: item.collection?.name
        }
      })

      const parent = firstGrid.parentElement

      // Чистим старые гриды (на случай повторного рендера)
      parent.querySelectorAll(".products-grid").forEach(g => g.remove())

      // По одному .products-grid на каждые 3 продукта — как на остальных страницах
      for (let i = 0; i < products.length; i += 3) {
        const grid = document.createElement("div")
        grid.className = "products-grid"

        const chunk = products.slice(i, i + 3)
        let html = chunk.map(productCard).join("")

        // ✅ добиваем неполный последний ряд невидимыми карточками,
        // чтобы реальные прижались влево нормальной шириной
        const missing = 3 - chunk.length
        for (let j = 0; j < missing; j++) {
          html += `<div class="product-card product-card--ghost" aria-hidden="true"></div>`
        }

        grid.innerHTML = html
        parent.appendChild(grid)
      }

      console.log("✅ Продукты рендерены по 3 в ряд!")
    }

  } catch (error) {
    console.error("❌ Ошибка загрузки деталей коллекции:", error)
  }
}