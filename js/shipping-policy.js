// ============= КОНФИГУРАЦИЯ =============

// 👇 ОБНОВИ ЭТИ ЗНАЧЕНИЯ 👇
const STRAPI_URL = "https://proper-gem-a18dd78c57.strapiapp.com";  // Замени на URL Cloud
const STRAPI_API_TOKEN = "2197bb7b3d3c2638449d4143d40549d2b1fb2b328762aa6a48f1a8679c4f661d7df363f0ba1186016f45f305044734e72bfb55c2e382c21025a420a5b543f839c57151063f9d4fd6bc26ba971a024eeeebf3fe92d75f3cfbc619b16bdb5f05524b93ccb4ee1de28da7666e9cfa2a59d459ac4fa6e9d06999301a39427244a5b6";        // Замени на API Token

// Кэширование
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут

// ============= ПЕРЕМЕННЫЕ =============

let currentLanguage = localStorage.getItem('selectedLanguage') || 'es';
let pageContent = null;

// ============= ИНИЦИАЛИЗАЦИЯ =============

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация страницы (shipping-policy.js)');
    
    // Проверь конфигурацию
    if (!isConfigValid()) {
        showConfigError();
        return;
    }

    // Загрузи контент
    loadContent();
    
    // 🔧 УНИВЕРСАЛЬНОЕ РЕШЕНИЕ: Отслеживаем изменения localStorage
    observeLanguageChanges();
    
    // 🔧 Также слушаем события от lang.js если они есть (для совместимости)
    document.addEventListener('languageChanged', (event) => {
        console.log(`🔔 Событие languageChanged получено: ${event.detail.language}`);
        const newLang = event.detail.language;
        if (newLang !== currentLanguage) {
            currentLanguage = newLang;
            if (pageContent) {
                renderContent();
            }
        }
    });
});

// ============= ПРОВЕРКА КОНФИГУРАЦИИ =============

function isConfigValid() {
    if (STRAPI_API_TOKEN === 'твой-api-token' || !STRAPI_URL) {
        console.error('❌ API токен или URL не настроены');
        return false;
    }
    return true;
}

// ============= ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ЯЗЫКА =============

function observeLanguageChanges() {
    console.log('👁️ Начинаю отслеживать изменения языка в localStorage');
    
    // Используем Polling каждые 100ms для проверки изменений (надежный способ)
    let lastLanguage = currentLanguage;
    
    setInterval(() => {
        const storedLanguage = localStorage.getItem('selectedLanguage');
        
        // Если язык в localStorage изменился
        if (storedLanguage && storedLanguage !== lastLanguage) {
            console.log(`🔄 Обнаружено изменение языка: ${lastLanguage} → ${storedLanguage}`);
            lastLanguage = storedLanguage;
            currentLanguage = storedLanguage;
            
            // Перерендеривай контент если он загружен
            if (pageContent) {
                console.log(`✅ Перерендеривается контент на языке: ${currentLanguage}`);
                renderContent();
            } else {
                console.warn('⚠️ Контент еще не загружен');
            }
        }
    }, 100); // Проверяем каждые 100ms (не нагружает браузер)
}

// ============= ЗАГРУЗКА КОНТЕНТА ИЗ STRAPI =============

async function loadContent() {
    try {
        const contentDiv = document.getElementById('content');
        
        // Проверь кэш
        const cacheKey = 'shipping-policy-content';
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(`${cacheKey}-time`);

        if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_DURATION) {
            console.log('✅ Использую кэшированный контент');
            pageContent = JSON.parse(cachedData);
            renderContent();
            return;
        }

        // Показать загрузку
        contentDiv.innerHTML = '<div class="loader">Cargando contenido...</div>';
        console.log('📥 Загружаю контент из Strapi...');

        // Загрузи с Strapi
        const response = await fetch(
            `${STRAPI_URL}/api/shipping-policies?populate=*`,
            {
                headers: {
                    'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();

        console.log('📦 Ответ от Strapi:', data);

        if (data.data && data.data.length > 0) {

            // STRAPI V5

            pageContent = data.data[0];

            localStorage.setItem(cacheKey, JSON.stringify(pageContent));

            localStorage.setItem(`${cacheKey}-time`, Date.now());

            renderContent();  // Это должно быть ПОСЛЕ присвоения!
        } else {
            console.error('❌ Контент не найден');
            showNoContentError();
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error.message);
        showConnectionError(error.message);
    }
}

// ============= РЕНДЕРИНГ КОНТЕНТА =============

function renderContent() {
    if (!pageContent) {
        console.warn('⚠️ pageContent is null, cannot render');
        return;
    }

    const contentDiv = document.getElementById('content');

    const titleKey = `title_${currentLanguage}`;
    const contentKey = `content_${currentLanguage}`;

    console.log(`🎨 Рендеринг контента на языке: ${currentLanguage}`);
    console.log(`   Ищу ключи: ${titleKey}, ${contentKey}`);
    console.log(`   Значения найдены:`, {
        title: !!pageContent[titleKey],
        content: !!pageContent[contentKey]
    });

    // 🔧 Проверяем что поля существуют
    if (!pageContent[titleKey] || !pageContent[contentKey]) {
        console.error(`❌ Поля не найдены! Доступные ключи:`, Object.keys(pageContent));
        contentDiv.innerHTML = `<p>⚠️ Контент для языка "${currentLanguage}" не найден в базе</p>`;
        return;
    }

    let html = '';

    html += `<h1 class="h1">${escapeHtml(pageContent[titleKey])}</h1>`;

    const formattedContent = pageContent[contentKey]
        .split('\n')
        .map(line => {
            if (/^\d+\./.test(line)) {
                return `<li>${escapeHtml(line.replace(/^\d+\.\s*/, ''))}</li>`;
            }
            return `<p>${escapeHtml(line)}</p>`;
        })
        .join('');

    html += `
    <div class="rich-text">
        <ol>
            ${formattedContent}
        </ol>
    </div>
    `;

    contentDiv.innerHTML = html;
}

// ============= СООБЩЕНИЯ ОБ ОШИБКАХ =============

function showConfigError() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error">
            <h2>⚙️ Ошибка конфигурации</h2>
            <p>Обновь переменные в файле <code>shipping-policy.js</code>:</p>
            <pre>const STRAPI_URL = 'https://твой-strapi.cloud';
const STRAPI_API_TOKEN = 'твой-api-token';</pre>
            <h3>Как получить значения:</h3>
            <ol>
                <li>STRAPI_URL: URL твоего Strapi (локальный или Cloud)</li>
                <li>API Token: Settings → API Tokens в админ-панели</li>
            </ol>
        </div>
    `;
}

function showAuthError() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error">
            <h2>❌ Ошибка авторизации</h2>
            <p>API токен неправильный или истёк.</p>
            <h3>Решение:</h3>
            <ol>
                <li>Открой админ-панель Strapi</li>
                <li>Settings → API Tokens</li>
                <li>Проверь или создай новый токен</li>
                <li>Убедись что включены права: find, findOne</li>
                <li>Обнови токен в shipping-policy.js</li>
            </ol>
        </div>
    `;
}

function showNoContentError() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error">
            <h2>❌ Контент не найден</h2>
            <p>В Strapi нет записи контент-типа "shipping-policy".</p>
            <h3>Решение:</h3>
            <ol>
                <li>Открой админ-панель Strapi</li>
                <li>Content Manager → shipping-policy</li>
                <li>+ Create new entry</li>
                <li>Заполни поля и нажми Publish</li>
            </ol>
        </div>
    `;
}

function showConnectionError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `<div class="error">
            <h2>❌ Ошибка подключения</h2>
            <p>${message}</p>
            <h3>Проверь:</h3>
            <ul>
                <li>Strapi запущен и доступен?</li>
                <li>URL правильный? (${STRAPI_URL})</li>
                <li>CORS настроен правильно?</li>
            </ul>
        </div>
    `;
}

// ============= УТИЛИТЫ =============

function escapeHtml(unsafe) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return unsafe.replace(/[&<>"']/g, m => map[m]);
}

// Глобальные функции для отладки
window.clearShippingPolicyCache = () => {
    localStorage.removeItem('shipping-policy-content');
    localStorage.removeItem('shipping-policy-content-time');
    console.log('🗑️ Кэш очищен');
    loadContent();
};

window.checkShippingPolicyConfig = () => {
    console.log('=== Конфигурация Shipping Policy ===');
    console.log('Strapi URL:', STRAPI_URL);
    console.log('Token установлен:', STRAPI_API_TOKEN !== 'твой-api-token');
    console.log('Текущий язык:', currentLanguage);
    console.log('Язык в localStorage:', localStorage.getItem('selectedLanguage'));
    console.log('Контент загружен:', !!pageContent);
    if (pageContent) {
        console.log('Доступные языки в контенте:', 
            Object.keys(pageContent).filter(k => k.startsWith('title_'))
        );
    }
};