import { initHeader } from "./header.js"
import { initFooter } from "./footer.js"
import { renderProducts, renderAllProducts } from "./products.js"
import { renderBasicsProducts } from "./products.js"
import { renderBanners } from "./banners.js"
import { renderGallery } from "./gallery.js"
import { renderCollections, renderCollectionDetail } from "./collections.js"
import { updateCartCount } from "./cart.js"
import { initLanguage, translatePage } from "./lang.js"

async function loadComponent(id, path, callback) {
  try {
    const res = await fetch(path)
    const html = await res.text()
    const container = document.getElementById(id)
    if (!container) return
    container.innerHTML = html
    
    requestAnimationFrame(() => {
      if (callback) callback()
      translatePage()
    })
  } catch (error) {
    console.error(`Error loading component: ${path}`, error)
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initLanguage()
  
  // ✅ Загрузи header
  const headerContainer = document.getElementById("header")
  if (headerContainer && !headerContainer.innerHTML.trim()) {
    await loadComponent("header", "/components/header.html", initHeader)
  } else if (headerContainer && headerContainer.innerHTML.trim()) {
    requestAnimationFrame(() => {
      initHeader()
      translatePage()
    })
  }
  
  // ✅ Загрузи footer
  const footerContainer = document.getElementById("footer")
  if (footerContainer && !footerContainer.innerHTML.trim()) {
    await loadComponent("footer", "/components/footer.html", initFooter)
  }
  
  // ✅ ОПРЕДЕЛИ ЧТО ЭТО ЗА СТРАНИЦА И ЗАГРУЗИ КОНТЕНТ
  const path = window.location.pathname;
  
  updateCartCount()
  
  // Главная страница
  if (path === '/' || path === '/index.html') {
    await renderBanners()  // ← Баннеры с продуктами
  }
  
  // Страница "Все товары"
  if (path.includes('/all')) {
    await renderAllProducts()
  }

  // Страница Basics
  if (path.includes('/basics')) {
    await renderBasicsProducts()
  }
  
  // Страница галереи
  if (path.includes('/gallery')) {
    await renderGallery()
  }
  
  // Страница коллекций
  if (path.includes('/collections')) {
    await renderCollections()
  }
  
  // Страница одной коллекции
  if (path.includes('collection.html')) {
    await renderCollectionDetail()
  }
  
  initVideoAutoplay()

  // ✅ НОВОЕ: Скрываем прелоадер в конце когда всё загружено
  if (window.globalPreloader) {
    window.globalPreloader.hide(700);
  } else if (window.hidePreloaderImmediately) {
    window.hidePreloaderImmediately();
  }
})

function initVideoAutoplay() {
  const videos = document.querySelectorAll('.video');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.play();
      } else {
        entry.target.pause();
      }
    });
  }, {
    threshold: 0.5
  });

  videos.forEach(video => observer.observe(video));
}