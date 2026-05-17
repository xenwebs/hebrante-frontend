import { getLanguage } from "./lang.js"

const API_URL = "https://proper-gem-a18dd78c57.strapiapp.com"

export async function renderGallery() {
  try {
    const lang = getLanguage();
    
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
      
      const description = lang === 'en' 
        ? (item.description_en || item.description) 
        : item.description;
      
      return {
        collection: item.collection,
        description: description,
        year: item.year,
        order: item.order || index,
        images: images.map(img => ({
          url1x: img.url,
          url2x: img.url,
          alt: item.collection
        }))
      }
    })

    const wrapper = document.querySelector(".wrapper")
    if (wrapper) {
      wrapper.innerHTML = "";
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

  // ✅ ПРОВЕРЬ ЕСЛИ ЭТО МОБИЛКА
  const isMobile = window.innerWidth <= 768;

  let html = "";

    html = `
      <div class="gallery__overlay">
        <div class="line">
          <p class="t1">${galleries[0]?.collection || ""}</p>
          <p class="t1">${galleries[0]?.year || ""}</p>
        </div>
      </div>
      <div class="gallery__overlay2">
        <div class="line">
          <p class="t2">${galleries[0]?.description || ""}</p>
        </div>
      </div>
    `;


  // ✅ ДОБАВЬ КАРТИНКИ
  galleries.forEach((gallery) => {
    gallery.images.forEach((img, idx) => {
      const desc = gallery.description || "";
      const dataAttrs = idx === 0 
        ? `data-collection="${gallery.collection}" data-year="${gallery.year}" data-desc="${desc}"`
        : ""

      html += `
        <section class="gallery__block" ${dataAttrs}>
          <div class="gallery__inner">
            <img class="gallery__img" src="${img.url1x}" srcset="${img.url2x} 2x" alt="${img.alt}">
          </div>
        </section>
      `
    })
  })

  wrapper.innerHTML = html
}

function initGallery(galleries) {
  const isMobile = window.innerWidth <= 768;
  
  // ✅ НА МОБИЛКЕ НЕ НУЖЕН ИНТЕРАКТИВ
  if (isMobile) return;

  const blocks = document.querySelectorAll('.gallery__block[data-collection]');
  if (!blocks.length) return;

  const titleEl = document.querySelector('.gallery__overlay .line .t1:first-child');
  const yearEl = document.querySelector('.gallery__overlay .line .t1:last-child');
  const descEl = document.querySelector('.gallery__overlay2 .t2');

  function updateText(block) {
    const line1 = document.querySelector('.gallery__overlay .line');
    const line2 = document.querySelector('.gallery__overlay2 .line');

    line1.classList.add('fade');
    line2.classList.add('fade');

    setTimeout(() => {
        titleEl.textContent = block.dataset.collection || "";
        yearEl.textContent = block.dataset.year || "";
        descEl.textContent = block.dataset.desc || "";

        line1.classList.remove('fade');
        line2.classList.remove('fade');
    }, 400);
  }

  updateText(blocks[0]);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            updateText(entry.target);
        }
    });
  }, {
    threshold: [0.1, 0.3, 0.5]
  });

  blocks.forEach(block => observer.observe(block));
}