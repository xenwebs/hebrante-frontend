import { getCartCount } from "/js/cart.js"
import { switchLanguage, getLanguage } from "/js/lang.js"

/**
 * Подставляет РЕАЛЬНУЮ высоту хедера в CSS-переменную --header-height.
 * Нужно потому что на мобилке .header имеет height: auto (подстраивается
 * под контент), а --header-height у нас захардкожен как 5vh и на мобилке
 * не переопределяется — из-за этого main получал недостаточный
 * padding-top и хедер наезжал на первый блок на странице (промо-полосу).
 * Теперь main всегда точно знает, сколько места занимает хедер,
 * на любом экране и при любых будущих правках вёрстки хедера.
 */
function syncHeaderHeight() {
  const header = document.querySelector(".header")
  if (!header) return
  document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`)
}

function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function initHeader(){
  const dropdown = document.querySelector('.lang-dropdown');
  
  if (!dropdown) {
    console.warn("'.lang-dropdown' не найден на странице");
    return;
  }
  
  const btn = dropdown.querySelector('.lang-dropdown__btn');
  const list = dropdown.querySelector('.lang-dropdown__list');
  const selected = dropdown.querySelector('.lang-dropdown__selected');
  
  // ✅ Функция чтобы обновить опции в дропдауне
  function updateDropdownOptions() {
    const currentLang = getLanguage();
    list.innerHTML = ''; // Очисти старые опции
    
    const otherLang = currentLang === 'es' ? 'en' : 'es';
    const otherLangText = otherLang === 'en' ? 'EN' : 'ES';
    
    const option = document.createElement('button');
    option.className = 'lang-dropdown__option';
    option.textContent = otherLangText;
    
    option.addEventListener('click', async () => {
      selected.textContent = otherLangText;
      dropdown.classList.remove('open');
      await switchLanguage(otherLang);
      updateDropdownOptions();  // ← Обнови опции после смены языка
    });
    
    list.appendChild(option);
  }
  
  // Инициализируй опции при загрузке
  updateDropdownOptions();
  
  // открыть / закрыть
  btn.addEventListener('click', () => {
    dropdown.classList.toggle('open');
  });
  
  // закрытие при клике вне
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // ============================================
  // МОБИЛЬНОЕ МЕНЮ
  // ============================================
  
  const burgerBtn = document.querySelector('.header__burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileMenuOverlay = document.querySelector('.mobile-menu__overlay');
  const mobileMenuLinks = document.querySelectorAll('.mobile-menu__link');
  
  if (!burgerBtn || !mobileMenu) {
    console.warn("Элементы для мобильного меню не найдены");
    return;
  }
  
  // Открыть/закрыть меню при клике на бургер
  burgerBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    burgerBtn.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  });
  
  // Закрыть меню при клике на оверлей
  mobileMenuOverlay.addEventListener('click', () => {
    mobileMenu.classList.remove('active');
    burgerBtn.classList.remove('active');
    document.body.classList.remove('menu-open');
  });
  
  // Закрыть меню при клике на пункт меню
  mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('active');
      burgerBtn.classList.remove('active');
      document.body.classList.remove('menu-open');
    });
  });

  // ============================================
  // СИНХРОНИЗАЦИЯ --header-height С РЕАЛЬНОЙ ВЫСОТОЙ
  // ============================================

  // Считаем сразу после того как хедер отрисован (rAF в main.js это гарантирует)
  syncHeaderHeight();

  // И пересчитываем при ресайзе/повороте экрана — с дебаунсом,
  // чтобы не дёргать layout на каждый пиксель во время ресайза
  window.addEventListener('resize', debounce(syncHeaderHeight, 150));
}