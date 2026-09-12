// js/popup.js — попап подписки на главной HEBRANTE

const STRAPI_URL = 'https://TU-PROYECTO.strapiapp.com'; // подставь свой, как в остальных модулях
const ENDPOINT = '/.netlify/functions/subscribe';
const KEY = 'hb_popup';
const MAX_CIERRES = 2;

/* ---------- состояние ---------- */

const leerEstado = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
};

const guardarEstado = (parche) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...leerEstado(), ...parche })); }
  catch { /* приватный режим — переживём */ }
};

/* ---------- язык и тексты ---------- */

const lang = document.documentElement.lang === 'en' ? 'en' : 'es';

const MESES = {
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['January','February','March','April','May','June',
       'July','August','September','October','November','December']
};

const UI = {
  es: {
    email: 'E-MAIL', nombre: 'NOMBRE', telefono: 'TELÉFONO / CONTACTO (OPCIONAL)',
    dia: 'DÍA', mes: 'MES', cumple: 'FECHA DE CUMPLEAÑOS',
    cerrar: 'Cerrar', enviando: 'ENVIANDO...', verMas: 'Ver más', verMenos: 'Ver menos',
    errEmail: 'Ingresa un correo válido',
    errNombre: 'Ingresa tu nombre',
    errCumple: 'Selecciona día y mes',
    errConsent: 'Debes aceptar la política de datos',
    errRed: 'No pudimos enviar tus datos. Intenta de nuevo.',
    errRate: 'Espera unos segundos antes de intentar de nuevo.',
    okTitulo: '¡Listo!',
    okTexto: 'Te enviaremos tu código de descuento a %EMAIL%. Revisa tu bandeja de entrada y la carpeta de spam.',
    yaTitulo: 'Ya estabas suscrito',
    yaTexto: 'Actualizamos tus datos. Seguirás recibiendo nuestras novedades en %EMAIL%.'
  },
  en: {
    email: 'E-MAIL', nombre: 'NAME', telefono: 'PHONE / CONTACT (OPTIONAL)',
    dia: 'DAY', mes: 'MONTH', cumple: 'DATE OF BIRTH',
    cerrar: 'Close', enviando: 'SENDING...', verMas: 'Read more', verMenos: 'Read less',
    errEmail: 'Enter a valid email',
    errNombre: 'Enter your name',
    errCumple: 'Select day and month',
    errConsent: 'You must accept the data policy',
    errRed: 'We could not send your details. Please try again.',
    errRate: 'Please wait a few seconds before trying again.',
    okTitulo: 'Done!',
    okTexto: 'We will send your discount code to %EMAIL%. Please check your inbox and spam folder.',
    yaTitulo: 'You were already subscribed',
    yaTexto: 'We updated your details. You will keep receiving our news at %EMAIL%.'
  }
}[lang];

/* ---------- конфиг из Strapi ---------- */

function normalizar(raw) {
  if (!raw) return null;
  return raw.attributes ? { id: raw.id, ...raw.attributes } : raw;
}

function urlMedia(campo) {
  const m = campo?.data?.attributes ?? campo;   // v4 / v5
  const u = m?.url;
  if (!u) return null;
  return u.startsWith('http') ? u : `${STRAPI_URL}${u}`;
}

async function cargarConfig() {
  try {
    const r = await fetch(`${STRAPI_URL}/api/popup-suscripcion?populate=*`);
    if (!r.ok) return null;
    const cfg = normalizar((await r.json())?.data);
    if (!cfg) return null;
    return {
      ...cfg,
      delay_segundos: cfg.delay_segundos ?? 25,
      scroll_porcentaje: cfg.scroll_porcentaje ?? 45,
      dias_reaparicion: cfg.dias_reaparicion ?? 30,
      _imagen: urlMedia(cfg.imagen),
      _imagenMovil: urlMedia(cfg.imagen_movil)
    };
  } catch {
    return null;   // Strapi недоступен — просто не показываем окно
  }
}

// текст с учётом языка: сначала _en, потом испанский как запасной
const t = (cfg, campo) =>
  (lang === 'en' ? cfg[`${campo}_en`] : null) || cfg[campo] || '';

/* ---------- условия показа ---------- */

const forzado = () => new URLSearchParams(location.search).has('popup');

function carritoTieneItems() {
  // TODO: подставить обращение к твоему модулю корзины
  try {
    const c = JSON.parse(localStorage.getItem('hb_cart') || '[]');
    return Array.isArray(c) && c.length > 0;
  } catch { return false; }
}

function puedeMostrar(cfg) {
  if (forzado()) return true;
  if (!cfg.activo) return false;

  const st = leerEstado();
  if (st.suscrito) return false;
  if ((st.cierres || 0) >= MAX_CIERRES) return false;
  if (st.ultimoCierre &&
      Date.now() - st.ultimoCierre < cfg.dias_reaparicion * 864e5) return false;

  if (new URLSearchParams(location.search).has('utm_campaign')) return false;
  if (carritoTieneItems()) return false;

  return true;
}

/* ---------- триггеры ---------- */

function armar(cfg) {
  if (forzado()) { mostrar(cfg); return; }

  let seg = 0, lanzado = false;

  const abrir = () => {
    if (lanzado) return;
    lanzado = true;
    limpiar();
    mostrar(cfg);
  };

  const tick = setInterval(() => {
    if (!document.hidden && ++seg >= cfg.delay_segundos) abrir();
  }, 1000);

  const onScroll = () => {
    const total = document.body.scrollHeight - innerHeight;
    if (total > 0 && (scrollY / total) * 100 >= cfg.scroll_porcentaje) abrir();
  };

  const onExit = (e) => { if (e.clientY <= 0) abrir(); };

  const limpiar = () => {
    clearInterval(tick);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('mouseleave', onExit);
  };

  addEventListener('scroll', onScroll, { passive: true });
  if (cfg.exit_intent && matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mouseleave', onExit);
  }
}

/* ---------- юридический текст ---------- */

const escapar = (s) => s.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// поддержка Markdown-ссылок и Blocks-редактора
function legalHTML(valor) {
  if (!valor) return '';

  if (Array.isArray(valor)) {                       // Rich text (Blocks)
    return valor.map((bloque) =>
      '<p>' + (bloque.children || []).map((hijo) => {
        const txt = escapar(hijo.text || '');
        return hijo.type === 'link'
          ? `<a href="${escapar(hijo.url)}" target="_blank" rel="noopener">${
              (hijo.children || []).map((c) => escapar(c.text || '')).join('')}</a>`
          : txt;
      }).join('') + '</p>'
    ).join('');
  }

  return escapar(String(valor))                     // Markdown
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

/* ---------- разметка ---------- */

let anteriorFoco = null;

function campo(tag, clase, attrs = {}) {
  const el = document.createElement(tag);
  el.className = clase;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function mostrar(cfg) {
  anteriorFoco = document.activeElement;

  const overlay = campo('div', 'hb-popup', {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hb-popup-titulo'
  });

  const caja = campo('div', 'hb-popup__caja');
  overlay.appendChild(caja);

  /* картинка */
  const esMovil = matchMedia('(max-width: 768px)').matches;
  const src = (esMovil && cfg._imagenMovil) || cfg._imagen;
  if (src) {
    const fig = campo('div', 'hb-popup__img');
    const img = campo('img', '', { src, alt: '', loading: 'lazy' });
    fig.appendChild(img);
    caja.appendChild(fig);
  }

  const cont = campo('div', 'hb-popup__cont');
  caja.appendChild(cont);

  /* закрыть */
  const btnX = campo('button', 'hb-popup__x', { type: 'button', 'aria-label': UI.cerrar });
  btnX.innerHTML = '&times;';
  caja.appendChild(btnX);

  /* тексты */
  const titulo = campo('h2', 'hb-popup__titulo', { id: 'hb-popup-titulo' });
  titulo.textContent = t(cfg, 'titulo');
  cont.appendChild(titulo);

  const sub = t(cfg, 'subtitulo');
  if (sub) {
    const p = campo('p', 'hb-popup__sub');
    p.textContent = sub;
    cont.appendChild(p);
  }

  const desc = cfg.descuento_texto;
  if (desc) {
    const d = campo('p', 'hb-popup__desc');
    d.textContent = desc;
    cont.appendChild(d);
  }

  const nota = t(cfg, 'nota');
  if (nota) {
    const n = campo('p', 'hb-popup__nota');
    n.textContent = nota;
    cont.appendChild(n);
  }

  /* форма */
  const form = campo('div', 'hb-popup__form');
  cont.appendChild(form);

  const mkInput = (name, type, label, extra = {}) => {
    const wrap = campo('div', 'hb-popup__campo');
    const input = campo('input', 'hb-popup__input', {
      type, name, placeholder: label, 'aria-label': label, ...extra
    });
    const err = campo('span', 'hb-popup__err');
    wrap.append(input, err);
    form.appendChild(wrap);
    return { input, err };
  };

  const fEmail = mkInput('email', 'email', UI.email, { autocomplete: 'email', required: 'required' });
  const fNombre = mkInput('nombre', 'text', UI.nombre, { autocomplete: 'given-name', required: 'required' });
  const fTel = mkInput('telefono', 'tel', UI.telefono, { autocomplete: 'tel' });

  /* день рождения: два селекта, без года */
  const wrapCumple = campo('div', 'hb-popup__campo hb-popup__cumple');
  const selDia = campo('select', 'hb-popup__select', { 'aria-label': UI.dia });
  selDia.appendChild(new Option(UI.dia, ''));
  for (let i = 1; i <= 31; i++) selDia.appendChild(new Option(String(i), String(i)));

  const selMes = campo('select', 'hb-popup__select', { 'aria-label': UI.mes });
  selMes.appendChild(new Option(UI.mes, ''));
  MESES[lang].forEach((m, i) => selMes.appendChild(new Option(m, String(i + 1))));

  const errCumple = campo('span', 'hb-popup__err');
  wrapCumple.append(selDia, selMes, errCumple);
  form.appendChild(wrapCumple);

  /* honeypot */
  const trampa = campo('input', 'hb-popup__trampa', {
    type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true'
  });
  form.appendChild(trampa);

  /* согласие: короткая подпись + мелкий текст под ней */
  const wrapCheck = campo('div', 'hb-popup__consent');

  const label = campo('label', 'hb-popup__check');
  const check = campo('input', '', { type: 'checkbox', name: 'consentimiento' });
  const spanTxt = campo('span', '');
  spanTxt.textContent = t(cfg, 'texto_checkbox');
  label.append(check, spanTxt);

  const errCheck = campo('span', 'hb-popup__err');
  wrapCheck.append(label, errCheck);

  const html = legalHTML(lang === 'en' ? (cfg.texto_legal_en || cfg.texto_legal) : cfg.texto_legal);
  if (html) {
    const legal = campo('div', 'hb-popup__legal');
    legal.innerHTML = html;

    const toggle = campo('button', 'hb-popup__legal-toggle', { type: 'button', 'aria-expanded': 'false' });
    toggle.textContent = UI.verMas;
    toggle.addEventListener('click', () => {
      const abierto = legal.classList.toggle('is-abierto');
      toggle.setAttribute('aria-expanded', String(abierto));
      toggle.textContent = abierto ? UI.verMenos : UI.verMas;
    });

    wrapCheck.append(legal, toggle);
  }

  form.appendChild(wrapCheck);

  /* кнопка */
  const btn = campo('button', 'hb-popup__btn', { type: 'button' });
  btn.textContent = t(cfg, 'texto_boton') || 'SUSCRIBIRSE';
  form.appendChild(btn);

  const errGeneral = campo('p', 'hb-popup__err hb-popup__err--general');
  form.appendChild(errGeneral);

  /* ---------- закрытие ---------- */

  let cerrado = false;

  const cerrar = (porSuscripcion = false) => {
    if (cerrado) return;
    cerrado = true;

    if (!porSuscripcion && !forzado()) {
      const st = leerEstado();
      guardarEstado({ cierres: (st.cierres || 0) + 1, ultimoCierre: Date.now() });
    }

    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-visible');
    document.body.classList.remove('hb-popup-abierto');
    setTimeout(() => overlay.remove(), 300);
    anteriorFoco?.focus?.();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { cerrar(); return; }
    if (e.key !== 'Tab') return;

    const focos = overlay.querySelectorAll(
      'button, input, select, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focos.length) return;
    const primero = focos[0], ultimo = focos[focos.length - 1];

    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };

  btnX.addEventListener('click', () => cerrar());
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(); });
  document.addEventListener('keydown', onKey);

  /* ---------- отправка ---------- */

  const limpiarErrores = () => {
    overlay.querySelectorAll('.hb-popup__err').forEach((e) => { e.textContent = ''; });
    overlay.querySelectorAll('.is-error').forEach((e) => e.classList.remove('is-error'));
  };

  const marcar = (spanErr, input, mensaje) => {
    spanErr.textContent = mensaje;
    input?.classList.add('is-error');
  };

  const enviar = async () => {
    if (btn.disabled) return;
    limpiarErrores();

    const email = fEmail.input.value.trim();
    const nombre = fNombre.input.value.trim();
    const dia = selDia.value, mes = selMes.value;

    let hayError = false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { marcar(fEmail.err, fEmail.input, UI.errEmail); hayError = true; }
    if (!nombre) { marcar(fNombre.err, fNombre.input, UI.errNombre); hayError = true; }
    if (!dia || !mes) { marcar(errCumple, selDia, UI.errCumple); hayError = true; }
    if (!check.checked) { marcar(errCheck, null, UI.errConsent); hayError = true; }
    if (hayError) { overlay.querySelector('.is-error')?.focus?.(); return; }

    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = UI.enviando;

    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nombre,
          telefono: fTel.input.value.trim() || undefined,
          cumple_dia: Number(dia),
          cumple_mes: Number(mes),
          consentimiento: check.checked,
          idioma: lang,
          fuente: 'popup-home',
          website: trampa.value
        })
      });

      const res = await r.json().catch(() => ({}));

      if (!r.ok) {
        btn.disabled = false;
        btn.textContent = textoOriginal;
        errGeneral.textContent = r.status === 429 ? UI.errRate : UI.errRed;
        return;
      }

      guardarEstado({ suscrito: true, fecha: Date.now() });
      exito(res.nuevo !== false, email);
    } catch {
      btn.disabled = false;
      btn.textContent = textoOriginal;
      errGeneral.textContent = UI.errRed;
    }
  };

  btn.addEventListener('click', enviar);
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); enviar(); }
  });

  const exito = (esNuevo, email) => {
    cont.innerHTML = '';
    const h = campo('h2', 'hb-popup__titulo');
    h.textContent = esNuevo ? UI.okTitulo : UI.yaTitulo;
    const p = campo('p', 'hb-popup__sub');
    p.textContent = (esNuevo ? UI.okTexto : UI.yaTexto).replace('%EMAIL%', email);
    cont.append(h, p);
    btnX.focus();
    setTimeout(() => cerrar(true), 6000);
  };

  /* ---------- вывод ---------- */

  document.body.appendChild(overlay);
  document.body.classList.add('hb-popup-abierto');
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  setTimeout(() => fEmail.input.focus({ preventScroll: true }), 300);
}

/* ---------- старт после прелоадера ---------- */

async function arrancar() {
  const cfg = await cargarConfig();
  if (cfg && puedeMostrar(cfg)) armar(cfg);
}

if (window.__preloaderDone) arrancar();
else document.addEventListener('preloader:done', arrancar, { once: true });