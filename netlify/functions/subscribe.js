// netlify/functions/subscribe.js

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

// множественное число — проверь API ID в Content-Type Builder
const COLECCION = 'suscriptors';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const IDIOMAS = ['es', 'en'];

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const limpiar = (v, max = 120) =>
  typeof v === 'string' ? v.trim().slice(0, max) : undefined;

const entero = (v, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

// мягкий троттлинг по IP: живёт в пределах тёплого инстанса,
// от случайного флуда спасает, от целенаправленного — нет
const vistos = new Map();
const demasiadoSeguido = (ip) => {
  const ahora = Date.now();
  for (const [k, t] of vistos) if (ahora - t > 60_000) vistos.delete(k);
  if (vistos.has(ip) && ahora - vistos.get(ip) < 10_000) return true;
  vistos.set(ip, ahora);
  return false;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'METHOD' });

  if (!STRAPI_URL || !STRAPI_TOKEN) {
    console.error('subscribe: faltan STRAPI_URL / STRAPI_TOKEN');
    return json(500, { error: 'CONFIG' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON' });
  }

  // honeypot: скрытое поле, заполняют только боты
  if (payload.website) return json(200, { ok: true, nuevo: false });

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    'desconocida';
  if (demasiadoSeguido(ip)) return json(429, { error: 'RATE' });

  const email = limpiar(payload.email, 254)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return json(400, { error: 'EMAIL' });

  // без явного согласия не сохраняем ничего
  if (payload.consentimiento !== true) return json(400, { error: 'CONSENT' });

  const data = {
    email,
    nombre: limpiar(payload.nombre, 80),
    telefono: limpiar(payload.telefono, 30),
    cumple_dia: entero(payload.cumple_dia, 1, 31),
    cumple_mes: entero(payload.cumple_mes, 1, 12),
    idioma: IDIOMAS.includes(payload.idioma) ? payload.idioma : 'es',
    consentimiento: true,
    fuente: limpiar(payload.fuente, 40) || 'popup-home'
  };

  // undefined не отправляем, чтобы не затирать уже сохранённые значения
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${STRAPI_TOKEN}`
  };

  try {
    const buscar = await fetch(
      `${STRAPI_URL}/api/${COLECCION}?filters[email][$eq]=${encodeURIComponent(email)}&fields[0]=email`,
      { headers }
    );

    if (!buscar.ok) {
      console.error('subscribe: búsqueda falló', buscar.status, await buscar.text());
      return json(502, { error: 'STRAPI' });
    }

    const encontrado = (await buscar.json())?.data?.[0];

    const res = encontrado
      ? await fetch(`${STRAPI_URL}/api/${COLECCION}/${encontrado.documentId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data })
        })
      : await fetch(`${STRAPI_URL}/api/${COLECCION}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data })
        });

    if (!res.ok) {
      console.error('subscribe: guardado falló', res.status, await res.text());
      return json(502, { error: 'STRAPI' });
    }

    return json(200, { ok: true, nuevo: !encontrado });
  } catch (err) {
    console.error('subscribe: error de red', err);
    return json(502, { error: 'NETWORK' });
  }
};