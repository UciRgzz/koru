const webpush = require('web-push');
const db = require('../config/database');

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function guardarSuscripcion(numeroPedido, subscription) {
  await db.query(
    'UPDATE pedidos SET push_subscription = $1 WHERE numero_pedido = $2',
    [JSON.stringify(subscription), numeroPedido]
  );
}

const MENSAJES = {
  confirmado:     { titulo: '✅ Pedido confirmado – KORU',     cuerpo: '¡Tu pedido fue confirmado! Pronto empezamos a prepararlo.' },
  en_preparacion: { titulo: '🧋 En preparación – KORU',        cuerpo: '¡Estamos preparando tu tapioca! Ya casi está...' },
  listo:          { titulo: '🎉 ¡Tu tapioca está lista! – KORU', cuerpo: 'Tu pedido está listo y será llevado a ti. ¡Disfrútalo!' },
  entregado:      { titulo: '📦 Pedido entregado – KORU',      cuerpo: '¡Gracias por tu pedido! Que lo disfrutes 💚' },
  cancelado:      { titulo: '❌ Pedido cancelado – KORU',       cuerpo: 'Tu pedido fue cancelado. Contáctanos si tienes dudas.' },
};

async function notificarCliente(pedido) {
  const msg = MENSAJES[pedido.estado];
  if (!msg) return;

  try {
    const { rows } = await db.query(
      'SELECT push_subscription FROM pedidos WHERE numero_pedido = $1',
      [pedido.numero_pedido]
    );
    if (!rows.length || !rows[0].push_subscription) return;

    const subscription = JSON.parse(rows[0].push_subscription);
    const trackingUrl  = `/tracking?pedido=${encodeURIComponent(pedido.numero_pedido)}&nombre=${encodeURIComponent(pedido.cliente_nombre || '')}`;

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ titulo: msg.titulo, cuerpo: msg.cuerpo, url: trackingUrl })
    );
    console.log(`📲 Push enviado a cliente pedido ${pedido.numero_pedido}`);
  } catch (err) {
    console.error('Push error:', err.message);
  }
}

module.exports = { guardarSuscripcion, notificarCliente };
