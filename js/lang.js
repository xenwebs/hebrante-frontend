let currentLanguage = 'es';
let translations = {}; // ← Сейчас будет пусто, загружаем из JSON

export async function loadTranslations(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
    translations = await response.json();
    console.log(`✅ Переводы загружены для языка: ${lang}`);
  } catch (error) {
    console.error('❌ Ошибка загрузки переводов:', error);
  }
}

export function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const lang = getLanguage();
    const text = translations[key] || key;
    
    // ✅ Используй innerHTML чтобы обработать &nbsp; и ссылки
    el.innerHTML = text;
  });
}

export async function switchLanguage(lang) {
  console.log("1️⃣ switchLanguage вызвана с языком:", lang);
  
  currentLanguage = lang;
  
  // 🔧 ИСПРАВЛЕНИЕ: Используй 'selectedLanguage' чтобы совпадало с shipping-policy.js
  localStorage.setItem('language', lang);
  localStorage.setItem('selectedLanguage', lang); // ← Добавили для совместимости
  
  // Загрузи переводы для нового языка
  await loadTranslations(lang);
  
  translatePage();

  // ✅ ВОТ ЗДЕСЬ добавь это:
  if (window.location.pathname.includes('all')) {
    const { renderAllProducts } = await import('./products.js');
    await renderAllProducts();
  }
  
  // ✅ Перезагрузи продукты если мы на главной
// ✅ Перезагрузи продукты если мы на главной
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  const { renderBanners } = await import('./banners.js');
  await renderBanners();  // ← убери renderProducts(), она пустая
}

if (window.location.pathname.includes('gallery')) {
  const { renderGallery } = await import('./gallery.js');
  await renderGallery();  // ← Перезагрузи галерею с новым языком
}

  if (window.location.pathname.includes('product')) {
    console.log("2️⃣ Мы на странице продукта, перезагружаю...");
    try {
      const { loadProduct } = await import('./product.js');
      console.log("3️⃣ loadProduct импортирована");
      await loadProduct();
      console.log("4️⃣ loadProduct завершена");
    } catch (e) {
      console.error("❌ Ошибка при загрузке продукта:", e);
    }
  }

  
  if (window.location.pathname.includes('collections')) {
    const { renderCollections } = await import('./collections.js');
    renderCollections();
  }
  
  // 🔧 ИСПРАВЛЕНИЕ: Диспатчим событие для shipping-policy.js
  console.log('🔔 Диспатчим событие languageChanged:', lang);
  document.dispatchEvent(new CustomEvent('languageChanged', { 
    detail: { language: lang } 
  }));
  
  console.log('🌐 Язык изменен на:', lang);
}

export function getLanguage() {
  return currentLanguage || localStorage.getItem('language') || 'es';
}

export function getTranslation(key) {
  return translations[key] || key; // Если нет перевода, вернёт сам ключ
}

export async function initLanguage() {
  currentLanguage = localStorage.getItem('language') || 'es';
  
  // 🔧 ИСПРАВЛЕНИЕ: Также сохраняем в 'selectedLanguage'
  localStorage.setItem('selectedLanguage', currentLanguage);
  
  // ✅ Загрузи переводы перед использованием
  await loadTranslations(currentLanguage);
  
  translatePage();
  console.log('🌐 Язык загруженный:', currentLanguage);
}