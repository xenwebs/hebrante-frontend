import { getCartCount } from "/js/cart.js"
import { switchLanguage, getLanguage } from "/js/lang.js"

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
}