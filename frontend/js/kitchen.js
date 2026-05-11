// ── Autenticación ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const usuarioActual = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!token || !usuarioActual) { window.location.href = '/login'; }
function authHeader() { return { 'Authorization': `Bearer ${token}` }; }
function cerrarSesion() { localStorage.clear(); window.location.href = '/login'; }

const socket = io();
let pedidos = {};

// ── Conexión Socket.io ─────────────────────────────────────────
socket.on('connect', () => {
  socket.emit('unirse', 'cocina');
  setEstado('🟢 Conectado');
});
socket.on('disconnect', () => setEstado('🔴 Desconectado'));
socket.on('connect_error', () => setEstado('🔴 Error de conexión'));

socket.on('nuevo_pedido', (pedido) => {
  pedidos[pedido.id] = pedido;
  renderTodo();
  notificar(`Nuevo pedido: #${pedido.numero_pedido}`);
});

socket.on('estado_pedido', (pedido) => {
  pedidos[pedido.id] = pedido;
  renderTodo();
});

socket.on('pedido_pagado', ({ pedido_id }) => {
  if (pedidos[pedido_id]) {
    pedidos[pedido_id].estado = 'entregado';
    renderTodo();
  }
});

// ── Carga inicial ──────────────────────────────────────────────
async function init() {
  const hoy = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/pedidos?fecha=${hoy}`, { headers: authHeader() });
  const { data } = await res.json();
  data.forEach(p => { pedidos[p.id] = p; });

  // Cargar items de cada pedido
  await Promise.all(Object.values(pedidos).map(async (p) => {
    if (!p.items) {
      const r = await fetch(`/api/pedidos/${p.id}`, { headers: authHeader() });
      const j = await r.json();
      pedidos[p.id] = j.data;
    }
  }));

  renderTodo();
}

function renderTodo() {
  const estados = {
    pendiente: ['colPendiente', 'countPendiente', ['pendiente', 'confirmado']],
    preparacion: ['colPreparacion', 'countPreparacion', ['en_preparacion']],
    listo: ['colListo', 'countListo', ['listo']],
  };

  for (const [col, countId, estadosFiltro] of Object.values(estados)) {
    const lista = Object.values(pedidos).filter(p => estadosFiltro.includes(p.estado));
    document.getElementById(countId).textContent = lista.length;
    const container = document.getElementById(col);
    if (!lista.length) {
      container.innerHTML = '<p class="no-pedidos">Sin pedidos</p>';
      continue;
    }
    container.innerHTML = lista.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).map(renderCard).join('');
  }
}

function renderCard(pedido) {
  const items = (pedido.items || []).map(i =>
    `<div class="cocina-item"><span class="item-qty">${i.cantidad}x</span> ${i.nombre}${i.notas ? ` <em>(${i.notas})</em>` : ''}</div>`
  ).join('');

  const tiempoMin = Math.floor((Date.now() - new Date(pedido.creado_en)) / 60000);

  const acciones = botonesAccion(pedido);

  const claseCard = pedido.estado === 'en_preparacion' ? 'preparacion' : pedido.estado === 'listo' ? 'listo' : '';

  return `
    <div class="cocina-card ${claseCard}" id="card-${pedido.id}">
      <div class="cocina-card-header">
        <h3>#${pedido.numero_pedido}</h3>
        <span class="tiempo-transcurrido">⏱ ${tiempoMin} min</span>
      </div>
      <div class="cocina-mesa">👤 ${pedido.cliente_nombre}${pedido.mesa ? ` · Mesa ${pedido.mesa}` : ''}</div>
      ${pedido.notas ? `<div class="cocina-mesa" style="color:#f39c12">📝 ${pedido.notas}</div>` : ''}
      <div style="margin:.6rem 0">${items}</div>
      <div class="cocina-actions">${acciones}</div>
    </div>
  `;
}

function botonesAccion(pedido) {
  const { id, estado } = pedido;
  if (estado === 'pendiente') return `
    <button class="btn-confirmar" onclick="cambiarEstado(${id},'confirmado')">✔ Confirmar</button>
    <button class="btn-cancelar" onclick="cambiarEstado(${id},'cancelado')">✕ Cancelar</button>
  `;
  if (estado === 'confirmado') return `
    <button class="btn-preparar" onclick="cambiarEstado(${id},'en_preparacion')">🔥 Preparar</button>
    <button class="btn-cancelar" onclick="cambiarEstado(${id},'cancelado')">✕ Cancelar</button>
  `;
  if (estado === 'en_preparacion') return `
    <button class="btn-listo" onclick="cambiarEstado(${id},'listo')">✅ Listo</button>
  `;
  if (estado === 'listo') return `
    <button class="btn-listo" onclick="cambiarEstado(${id},'entregado')" style="background:#888">📦 Entregado</button>
  `;
  return '';
}

async function cambiarEstado(id, estado) {
  await fetch(`/api/pedidos/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ estado }),
  });
}

// ── UI helpers ─────────────────────────────────────────────────
function setEstado(texto) {
  document.getElementById('estadoConexion').textContent = texto;
}

function notificar(mensaje) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🍳 Cocina', { body: mensaje });
  }
}

function actualizarReloj() {
  const el = document.getElementById('fechaHora');
  if (el) el.textContent = new Date().toLocaleTimeString('es-ES');
}

// ── Inicio ─────────────────────────────────────────────────────
if ('Notification' in window) Notification.requestPermission();
setInterval(actualizarReloj, 1000);
setInterval(renderTodo, 30000); // refresca tiempos cada 30s
actualizarReloj();
init();
