// ============================================
// ГЛОБАЛЬНЫЙ ПРЕЛОАДЕР - ЛОГИКА
// ============================================

class GlobalPreloader {
  constructor() {
    this.preloader = document.getElementById('global-preloader');
    this.hideTimeout = null;
  }

  // Показать прелоадер
  show() {
    if (!this.preloader) {
      console.warn('Preloader element not found');
      return;
    }
    
    this.preloader.classList.remove('hidden');
    
    // Очистить старый таймаут если был
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
  }

  // Скрыть прелоадер с задержкой
  hide(delay = 300) {
    if (!this.preloader) return;

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = setTimeout(() => {
      this.preloader.classList.add('hidden');
    }, delay);
  }

  // Автоматически скрывать когда страница загружена
  hideOnPageLoad() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.hide(500);
      });
    } else {
      // Страница уже загружена
      this.hide(300);
    }
  }
}

// Инициализируй глобальный прелоадер
const globalPreloader = new GlobalPreloader();

// Автоматически скрывай при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  globalPreloader.hide(500);
});

// Опционально: показывай прелоадер при навигации между страницами
window.addEventListener('beforeunload', () => {
  globalPreloader.show();
});

// Опционально: для SPA приложений
function showPreloaderForNavigation() {
  globalPreloader.show();
}

function hidePreloaderAfterFetch() {
  globalPreloader.hide(300);
}