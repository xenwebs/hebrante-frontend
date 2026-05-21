// ============================================
// ГЛОБАЛЬНЫЙ ПРЕЛОАДЕР - ЛОГИКА
// ============================================

class GlobalPreloader {
  constructor() {
    this.preloader = document.getElementById('global-preloader');
    this.hideTimeout = null;
    this.showTime = null;
    this.minShowDuration = 500; // Минимум 500ms показа прелоадера
  }

  show() {
    if (!this.preloader) return;
    
    this.preloader.classList.remove('hidden');
    this.showTime = Date.now();
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
  }

  hide(delay = 300) {
    if (!this.preloader) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    // ✅ Вычисляем сколько прелоадер уже был виден
    const elapsedTime = Date.now() - (this.showTime || Date.now());
    
    // ✅ Если прошло меньше чем minShowDuration, ждём
    const remainingTime = Math.max(0, this.minShowDuration - elapsedTime);
    const totalDelay = delay + remainingTime;

    this.hideTimeout = setTimeout(() => {
      this.preloader.classList.add('hidden');
      this.showTime = null;
    }, totalDelay);
  }

  hideOnPageLoad() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.hide(500);
      });
    } else {
      this.hide(300);
    }
  }

  // ✅ НОВОЕ: Быстрое скрытие БЕЗ задержки (для карточек товаров)
  hideImmediately() {
    if (!this.preloader) return;
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    this.preloader.classList.add('hidden');
    this.showTime = null;
  }
}

// Инициализируй глобальный прелоадер
const globalPreloader = new GlobalPreloader();

// ✅ Показываем прелоадер при загрузке страницы
globalPreloader.show();

// ✅ Скрываем когда контент готов
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    globalPreloader.hide(500);
  }, 200);
});

// ✅ Показываем при переходе на другую страницу
window.addEventListener('beforeunload', () => {
  globalPreloader.show();
});

// ✅ Скрываем если вернулись по кнопке браузера (back)
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('Возврат на страницу из кэша');
    globalPreloader.hide(200);
  }
});

// Опционально: для SPA приложений
function showPreloaderForNavigation() {
  globalPreloader.show();
}

function hidePreloaderAfterFetch() {
  globalPreloader.hide(300);
}

// ✅ НОВОЕ: для быстрого скрытия (например при загрузке карточек)
function hidePreloaderImmediately() {
  globalPreloader.hideImmediately();
}