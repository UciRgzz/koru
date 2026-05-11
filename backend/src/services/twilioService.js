const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

function formatearComprobante(pedido, comprobante, items) {
  const fecha = new Date(comprobante.creado_en).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const lineasItems = items
    .map(i => `  • ${i.nombre} x${i.cantidad}  $${Number(i.subtotal).toFixed(2)}`)
    .join('\n');

  const metodoPago = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  }[comprobante.metodo_pago] || comprobante.metodo_pago;

  let mensaje = `🧾 *COMPROBANTE DE PAGO*\n`;
  mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
  mensaje += `📋 Pedido: *#${pedido.numero_pedido}*\n`;
  mensaje += `🗓️ Fecha: ${fecha}\n`;
  if (pedido.mesa) mensaje += `🪑 Mesa: ${pedido.mesa}\n`;
  mensaje += `\n*Detalle:*\n${lineasItems}\n`;
  mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
  mensaje += `💰 Total: *$${Number(comprobante.monto_total).toFixed(2)}*\n`;
  mensaje += `💳 Pago con: ${metodoPago}\n`;
  if (comprobante.cambio > 0) {
    mensaje += `💵 Cambio: $${Number(comprobante.cambio).toFixed(2)}\n`;
  }
  mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
  mensaje += `¡Gracias por su preferencia! 🙏`;

  return mensaje;
}

async function enviarComprobante(telefono, pedido, comprobante, items) {
  const numero = telefono.startsWith('+') ? telefono : `+${telefono}`;
  const mensaje = formatearComprobante(pedido, comprobante, items);

  const result = await client.messages.create({
    from: WHATSAPP_FROM,
    to: `whatsapp:${numero}`,
    body: mensaje,
  });

  return result.sid;
}

async function enviarImagenWhatsApp(telefono, mediaUrl, caption) {
  const digits = telefono.replace(/\D/g, '');
  const numero = digits.startsWith('52') ? `+${digits}` : `+52${digits}`;
  const result = await client.messages.create({
    from: WHATSAPP_FROM,
    to:   `whatsapp:${numero}`,
    mediaUrl: [mediaUrl],
    body: caption || '',
  });
  return result.sid;
}

module.exports = { enviarComprobante, enviarImagenWhatsApp };
