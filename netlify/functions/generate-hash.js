import crypto from 'node:crypto';
import { json, strapiGet, loadValidPromo, calculateDiscount, subtotalOf } from './lib/promo.js';

const BOLD_SECRET = (process.env.BOLD_SECRET_KEY || '').trim();

// Подпись для Bold выдаём только для реального заказа из Strapi, который ещё
// не оплачен, и только если сумма и промокод в нём сходятся. Это последний
// рубеж перед оплатой: без подписи кнопка Bold не работает, поэтому здесь же
// окончательно проверяется, что одноразовый промокод ещё не использован.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'bad_request' });
    }

    const { orderId, amount, currency } = body;

    console.log('📝 Генерирую хеш для:', { orderId, amount, currency });

    if (!BOLD_SECRET) {
      console.error('❌ BOLD_SECRET_KEY не задан в окружении');
      return json(500, { error: 'Configuration error' });
    }

    // orderId приходит как "ORD-<documentId>"
    const match = /^ORD-([A-Za-z0-9_-]+)$/.exec(String(orderId || ''));
    if (!match || currency !== 'COP' || !Number.isFinite(Number(amount))) {
      return json(400, { error: 'bad_request' });
    }
    const documentId = match[1];

    // 1) Заказ должен существовать и быть неоплаченным
    const orderJson = await strapiGet(`/orders/${encodeURIComponent(documentId)}`);
    const order = orderJson?.data;
    if (!order) return json(404, { error: 'order_not_found' });
    if (order.orderStatus !== 'pending') {
      return json(409, { error: 'order_not_pending' });
    }

    // 2) Подписываем ту сумму, что записана в заказе
    if (Number(order.total) !== Number(amount)) {
      console.warn('⚠️ amount_mismatch', { documentId, orderTotal: order.total, amount });
      return json(400, { error: 'amount_mismatch' });
    }

    // 3) Скидка должна быть подтверждена настоящим промокодом
    const items = Array.isArray(order.items) ? order.items : [];
    const discount = Number(order.discount) || 0;
    const promoCode = String(order.promoCode || '').trim();

    if (promoCode) {
      const result = await loadValidPromo(promoCode);
      if (!result.promo) {
        // invalid / not_started / expired / exhausted
        console.warn('⚠️ promo rechazado:', { documentId, promoCode, reason: result.error });
        return json(409, { error: `promo_${result.error}` });
      }

      const { promo } = result;

      if (promo.minPurchase && subtotalOf(items) < promo.minPurchase) {
        return json(409, { error: 'promo_min_purchase' });
      }

      const maxDiscount = calculateDiscount(items, promo.discountPercent, promo.applicableIds);
      if (Number(order.discountPercent) !== promo.discountPercent || discount > maxDiscount) {
        console.warn('⚠️ promo_mismatch', { documentId, promoCode, discount, maxDiscount });
        return json(409, { error: 'promo_mismatch' });
      }
    } else if (discount > 0) {
      console.warn('⚠️ скидка без промокода', { documentId, discount });
      return json(409, { error: 'promo_mismatch' });
    }

    const concatenate = orderId + amount + currency + BOLD_SECRET;

    const hash = crypto
      .createHash('sha256')
      .update(concatenate)
      .digest('hex');

    console.log('✅ Хеш сгенерирован для заказа:', orderId);

    return json(200, {
      success: true,
      integritySignature: hash
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return json(500, { error: 'server_error' });
  }
};