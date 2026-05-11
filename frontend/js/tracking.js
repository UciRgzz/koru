// ── Parámetros de la URL ──────────────────────────────────────
const params        = new URLSearchParams(window.location.search);
const numeroPedido  = params.get('pedido') || '';
const nombreCliente = params.get('nombre') || 'Cliente';

// ── Push Notifications ────────────────────────────────────────
async function activarNotificaciones() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    // Registrar Service Worker
    const reg = await navigator.serviceWorker.register('/sw.js');

    // Pedir permiso al usuario
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return;

    // Obtener clave pública VAPID del servidor
    const { publicKey } = await fetch('/api/push/vapid-public-key').then(r => r.json());

    // Suscribirse al push
    const suscripcion = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Enviar suscripción al backend junto con el número de pedido
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: suscripcion, numeroPedido }),
    });

    console.log('✅ Notificaciones push activadas');
  } catch (err) {
    console.warn('Push no disponible:', err.message);
  }
}

function urlBase64ToUint8Array(base64) {
  const pad  = '='.repeat((4 - base64.length % 4) % 4);
  const b64  = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw  = atob(b64);
  const arr  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ── Orden de estados ──────────────────────────────────────────
const ORDEN = { pendiente: 0, confirmado: 1, en_preparacion: 2, listo: 3, entregado: 4 };
const PASOS = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado'];

const MENSAJES = {
  pendiente:      '⏳ Tu pedido fue recibido. Esperando confirmación de KORU...',
  confirmado:     '✅ ¡Pedido confirmado! Enseguida comenzamos a prepararlo.',
  en_preparacion: '🧋 ¡Estamos preparando tu tapioca! Ya casi está lista...',
  listo:          '🎉 ¡Tu tapioca está lista y será llevada a ti!',
  entregado:      '📦 ¡Entregado! Esperamos que lo hayas disfrutado. 💚',
  cancelado:      '❌ Tu pedido fue cancelado. Contáctanos si tienes dudas.',
};

// ── Inicializar UI ────────────────────────────────────────────
document.getElementById('saludoCliente').textContent = `Hola, ${nombreCliente} 👋`;
document.getElementById('numeroPedidoDisplay').textContent = numeroPedido
  ? `Pedido #${numeroPedido}`
  : 'Número de pedido no encontrado';

// ── Obtener estado actual + activar push ──────────────────────
if (numeroPedido) {
  fetch(`/api/pedidos/status/${encodeURIComponent(numeroPedido)}`)
    .then(r => r.json())
    .then(json => {
      if (json.ok) actualizarTracking(json.data.estado);
    })
    .catch(() => {});

  // Activar notificaciones push (pide permiso al usuario)
  activarNotificaciones();
}

// ── Socket.io ─────────────────────────────────────────────────
const socket = io();

socket.on('connect', () => {
  setConexion('ok', 'En línea · Actualizaciones en tiempo real');
  if (numeroPedido) socket.emit('seguir_pedido', numeroPedido);
});

socket.on('disconnect', () => {
  setConexion('off', 'Sin conexión · Reintentando...');
});

socket.on('estado_pedido', (pedido) => {
  if (pedido.numero_pedido !== numeroPedido) return;
  actualizarTracking(pedido.estado);
  if (pedido.estado === 'listo') mostrarNotifListo();
});

// ── Actualizar pasos ──────────────────────────────────────────
function actualizarTracking(estado) {
  const idx = ORDEN[estado] ?? -1;

  PASOS.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`);
    if (!el) return;
    el.classList.remove('done', 'current');
    if (i < idx)      el.classList.add('done');
    else if (i === idx) el.classList.add('current');
  });

  // Líneas entre pasos
  for (let i = 0; i < 4; i++) {
    const line = document.getElementById(`line-${i}`);
    if (line) line.classList.toggle('done', i < idx);
  }

  // Mensaje
  const msgEl = document.getElementById('statusMsg');
  msgEl.textContent = MENSAJES[estado] || '';
  msgEl.className = 'status-msg';
  if (estado === 'listo')     msgEl.classList.add('listo');
  if (estado === 'cancelado') msgEl.classList.add('cancelado');

  // Si está cancelado, marcar el step actual con estilo especial
  if (estado === 'cancelado') {
    PASOS.forEach(s => {
      const el = document.getElementById(`step-${s}`);
      if (el) el.classList.remove('done', 'current');
    });
  }
}

// ── Notificación cuando el pedido está listo ──────────────────
function mostrarNotifListo() {
  const banner = document.getElementById('bannerListo');
  banner.classList.add('visible');

  // Vibración en celular (si el navegador lo soporta)
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]);

  // Toast adicional
  toast('🎉 ¡Tu tapioca está lista!', 'success', 8000);

  // Scroll arriba para ver el banner
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Indicador de conexión ─────────────────────────────────────
function setConexion(estado, texto) {
  const dot   = document.getElementById('conexionDot');
  const label = document.getElementById('conexionLabel');
  dot.className   = `conexion-dot ${estado}`;
  label.textContent = texto;
}
