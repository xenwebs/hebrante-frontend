// ============================================
// ГЛОБАЛЬНЫЙ ПРЕЛОАДЕР - ЛОГИКА
// ============================================

class GlobalPreloader {
  constructor() {
    this._el = null;
    this.hideTimeout = null;
    this.safetyTimeout = null;
    this.showTime = Date.now();
    this.minShowDuration = 700; // минимум показа, чтобы не мигал
  }

  // ленивый поиск — на случай если скрипт подключён до разметки
  get preloader() {
    if (!this._el) this._el = document.getElementById('global-preloader');
    return this._el;
  }

  show() {
    if (!this.preloader) return;
    clearTimeout(this.hideTimeout);
    this.preloader.classList.remove('hidden');
    this.showTime = Date.now();
  }

  hide(delay = 300) {
    if (!this.preloader) return;
    clearTimeout(this.hideTimeout);

    const elapsed = Date.now() - (this.showTime || Date.now());
    const remaining = Math.max(0, this.minShowDuration - elapsed);

    this.hideTimeout = setTimeout(() => {
      clearTimeout(this.safetyTimeout);
      this.preloader.classList.add('hidden');
      this.showTime = null;
    }, delay + remaining);
  }

  hideImmediately() {
    if (!this.preloader) return;
    clearTimeout(this.hideTimeout);
    clearTimeout(this.safetyTimeout);
    this.preloader.classList.add('hidden');
    this.showTime = null;
  }

  // страховка: если рендер упал с ошибкой — не оставляем юзера на белом экране
  startSafetyNet(ms = 8000) {
    this.safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Прелоадер скрыт по таймауту-страховке');
      this.hideImmediately();
    }, ms);
  }
}

const globalPreloader = new GlobalPreloader();
window.globalPreloader = globalPreloader;   // ← вот этого не хватало

globalPreloader.show();
globalPreloader.startSafetyNet(8000);

// ❌ УБРАН авто-hide на DOMContentLoaded — теперь этим управляет main.js

window.addEventListener('beforeunload', () => {
  globalPreloader.show();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    globalPreloader.hide(200);
  }
});