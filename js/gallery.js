import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

/* Экранирование — значения из Strapi попадают в HTML-атрибуты.
   Одна двойная кавычка в description ломала разметку блока. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export async function renderGallery() {
  try {
    const lang = getLanguage()

    const res = await fetch(
      `${API_URL}/api/galerias?populate=*&sort=order:asc`
    )

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`)
    }

    const data = await res.json()

    if (!data.data || data.data.length === 0) {
      console.warn("⚠️ Нет галереи в Strapi")
      return
    }

    const galleries = data.data.map((item, index) => {
      const images = item.fotos || []

      const description = lang === "en"
        ? (item.description_en || item.description)
        : item.description

      return {
        collection: item.collection,
        description: description,
        year: item.year,
        order: item.order || index,
        images: images.map(img => ({
          url1x: img.url,
          url2x: img.url,
          // размеры из Strapi — без них браузер не резервирует место
          // под картинку, все блоки на старте имеют нулевую высоту
          width: img.width,
          height: img.height,
          alt: item.collection
        }))
      }
    })

    const wrapper = document.querySelector(".wrapper")
    if (wrapper) {
      wrapper.innerHTML = ""
    }

    renderGalleryBlocks(galleries)
    initGallery(galleries)

  } catch (error) {
    console.error("❌ Ошибка загрузки галереи:", error)
  }
}

function renderGalleryBlocks(galleries) {
  const wrapper = document.querySelector(".wrapper")
  if (!wrapper) return

  let html = `
      <div class="gallery__overlay">
        <div class="line">
          <p class="t1">${esc(galleries[0]?.collection)}</p>
          <p class="t1">${esc(galleries[0]?.year)}</p>
        </div>
      </div>
      <div class="gallery__overlay2">
        <div class="line">
          <p class="t2">${esc(galleries[0]?.description)}</p>
        </div>
      </div>
    `

  // z-index больше не берётся из :nth-child в CSS — тот список
  // обрывался на 26 и был сдвинут на два оверлея
  let z = 1

  galleries.forEach((gallery) => {
    gallery.images.forEach((img, idx) => {
      const dataAttrs = idx === 0
        ? `data-collection="${esc(gallery.collection)}" data-year="${esc(gallery.year)}" data-desc="${esc(gallery.description)}"`
        : ""

      const dims = (img.width && img.height)
        ? ` width="${img.width}" height="${img.height}"`
        : ""

      html += `
        <section class="gallery__block" style="z-index:${z++}" ${dataAttrs}>
          <div class="gallery__inner">
            <img class="gallery__img" src="${esc(img.url1x)}" srcset="${esc(img.url2x)} 2x" alt="${esc(img.alt)}"${dims} decoding="async">
          </div>
        </section>
      `
    })
  })

  wrapper.innerHTML = html
}

function initGallery() {
  const isMobile = window.innerWidth <= 768
  if (isMobile) return

  const wrapper = document.querySelector(".wrapper")
  const blocks = Array.from(
    document.querySelectorAll(".gallery__block[data-collection]")
  )
  if (!wrapper || !blocks.length) return

  const titleEl = document.querySelector(".gallery__overlay .line .t1:first-child")
  const yearEl = document.querySelector(".gallery__overlay .line .t1:last-child")
  const descEl = document.querySelector(".gallery__overlay2 .t2")
  const line1 = document.querySelector(".gallery__overlay .line")
  const line2 = document.querySelector(".gallery__overlay2 .line")
  if (!titleEl || !yearEl || !descEl) return

  /* Блоки — position: sticky, поэтому getBoundingClientRect() у прилипшего
     блока всегда даёт top = 0 и по нему нельзя понять, где блок в потоке.
     offsetTop от sticky не зависит — считаем позицию по нему. */
  let tops = []

  function measure() {
    tops = blocks.map(block => {
      let y = 0
      let el = block
      while (el) {
        y += el.offsetTop
        el = el.offsetParent
      }
      return y
    })
  }

  let current = null
  let fadeTimer = null

  function apply(block) {
    if (block === current) return
    current = block

    // без сброса таймера быстрый скролл ставил в очередь несколько
    // переключений, и текст оседал на случайной коллекции
    clearTimeout(fadeTimer)

    line1?.classList.add("fade")
    line2?.classList.add("fade")

    fadeTimer = setTimeout(() => {
      titleEl.textContent = block.dataset.collection || ""
      yearEl.textContent = block.dataset.year || ""
      descEl.textContent = block.dataset.desc || ""

      line1?.classList.remove("fade")
      line2?.classList.remove("fade")
    }, 400)
  }

  /* Активная коллекция — последняя, чей первый кадр уже пересёк линию
     переключения. 0.55 = чуть ниже середины экрана: текст меняется тогда,
     когда новая картинка реально заняла экран, а не когда её край
     показался снизу. Подкрути это число, если хочется раньше/позже. */
  const SWITCH_LINE = 0.55

  function update() {
    const y = window.scrollY + window.innerHeight * SWITCH_LINE
    let active = blocks[0]
    for (let i = 0; i < blocks.length; i++) {
      if (tops[i] <= y) active = blocks[i]
      else break
    }
    apply(active)
  }

  let ticking = false
  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      update()
    })
  }

  measure()
  // первый показ — без задержки в 400ms
  current = blocks[0]
  titleEl.textContent = blocks[0].dataset.collection || ""
  yearEl.textContent = blocks[0].dataset.year || ""
  descEl.textContent = blocks[0].dataset.desc || ""

  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", () => {
    measure()
    update()
  })

  // высоты блоков меняются по мере догрузки картинок — пересчитываем
  wrapper.querySelectorAll("img").forEach(img => {
    if (!img.complete) {
      img.addEventListener("load", () => {
        measure()
        update()
      }, { once: true })
    }
  })

  window.addEventListener("load", () => {
    measure()
    update()
  })
}