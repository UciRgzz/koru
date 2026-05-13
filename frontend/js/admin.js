// ── Autenticación ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const usuarioActual = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!token || !usuarioActual) { window.location.href = '/login'; }

function authHeader() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}
function cerrarSesion() {
  localStorage.clear();
  window.location.href = '/login';
}

// ── Socket.io ─────────────────────────────────────────────────
const socket = io();
let pedidos = {};      // estado del tablero
let pedidoActualId = null;

socket.on('connect', () => {
  socket.emit('unirse', 'admin');
  setEstado('🟢 Conectado');
});
socket.on('disconnect', () => setEstado('🔴 Desconectado'));

socket.on('nuevo_pedido', (pedido) => {
  pedidos[pedido.id] = pedido;
  renderTablero();
  notificarNuevoPedido(pedido.numero_pedido);
  toast(`🛒 Nuevo pedido #${pedido.numero_pedido} de ${pedido.cliente_nombre}`, 'info', 6000);
});
socket.on('estado_pedido', (pedido) => {
  pedidos[pedido.id] = pedido;
  renderTablero();
  cargarPedidos();
});
socket.on('pedido_pagado', ({ pedido_id }) => {
  if (pedidos[pedido_id]) { pedidos[pedido_id].estado = 'entregado'; renderTablero(); }
  cargarPedidos();
});
socket.on('whatsapp_enviado', () => {
  const el = document.getElementById('whatsappStatus');
  if (el) { el.textContent = '✅ Comprobante enviado por WhatsApp'; }
});

// ── Tabs ──────────────────────────────────────────────────────
function mostrarTab(nombre, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab${nombre.charAt(0).toUpperCase() + nombre.slice(1)}`).classList.add('active');
  if (btn) btn.classList.add('active');
  if (nombre === 'comprobantes') cargarComprobantes();
  if (nombre === 'pedidos') cargarPedidos();
}

// ── TABLERO EN TIEMPO REAL ────────────────────────────────────
async function iniciarTablero() {
  const hoy = fechaLocalHoy();
  const res = await fetch(`/api/pedidos?fecha=${hoy}`, { headers: authHeader() });
  if (res.status === 401) { cerrarSesion(); return; }
  const { data } = await res.json();

  // Cargar items de cada pedido
  await Promise.all(data.map(async (p) => {
    const r = await fetch(`/api/pedidos/${p.id}`, { headers: authHeader() });
    const j = await r.json();
    pedidos[p.id] = j.data;
  }));

  renderTablero();
}

function renderTablero() {
  const columnas = [
    { col: 'colPendiente',   count: 'countPendiente',   estados: ['pendiente', 'confirmado'] },
    { col: 'colPreparacion', count: 'countPreparacion',  estados: ['en_preparacion'] },
    { col: 'colListo',       count: 'countListo',        estados: ['listo'] },
  ];

  for (const { col, count, estados } of columnas) {
    const lista = Object.values(pedidos)
      .filter(p => estados.includes(p.estado))
      .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

    document.getElementById(count).textContent = lista.length;
    const container = document.getElementById(col);

    if (!lista.length) {
      container.innerHTML = '<p class="no-pedidos-light">Sin pedidos</p>';
      continue;
    }
    container.innerHTML = lista.map(p => renderCardTablero(p)).join('');
  }

  // Actualizar barra de estadísticas
  const todos = Object.values(pedidos);
  const activos = todos.filter(p => !['entregado','cancelado'].includes(p.estado)).length;
  const entregados = todos.filter(p => p.estado === 'entregado');
  const ingresos = entregados.reduce((s, p) => s + Number(p.total), 0);
  const sb = document.getElementById('statsBar');
  if (sb) sb.innerHTML = `
    <div class="stat-card"><span class="stat-value">${activos}</span><span class="stat-label">En proceso</span></div>
    <div class="stat-card"><span class="stat-value">${entregados.length}</span><span class="stat-label">Entregados hoy</span></div>
    <div class="stat-card"><span class="stat-value">$${ingresos.toFixed(0)}</span><span class="stat-label">Ingresos del día</span></div>
    <div class="stat-card"><span class="stat-value">${todos.filter(p => p.estado === 'cancelado').length}</span><span class="stat-label">Cancelados</span></div>
  `;
}

function renderCardTablero(p) {
  const items = (p.items || []).map(i =>
    `<div class="cocina-item"><span class="item-qty">${i.cantidad}x</span> ${i.nombre}</div>`
  ).join('');
  const min = Math.floor((Date.now() - new Date(p.creado_en)) / 60000);
  const claseCard = p.estado === 'en_preparacion' ? 'preparacion' : p.estado === 'listo' ? 'listo' : p.estado === 'entregado' ? 'entregado-card' : '';

  const botones = botonesTablero(p);

  return `
    <div class="cocina-card ${claseCard}">
      <div class="cocina-card-header">
        <h3 style="cursor:pointer;text-decoration:underline" onclick="verDetalle(${p.id})">#${p.numero_pedido}</h3>
        <span class="tiempo-transcurrido">⏱ ${min} min</span>
      </div>
      <div class="cocina-mesa">
        👤 ${p.cliente_nombre} · ${iconoPago(p.metodo_pago)}
        ${p.cliente_telefono ? `<a href="tel:${p.cliente_telefono}" class="btn-llamar" title="Llamar cliente">📞</a>` : ''}
      </div>
      ${p.tipo_leche && p.tipo_leche !== 'clasica' ? `<div class="cocina-mesa" style="color:#7C3AED;font-weight:700">🥛 Leche de ${p.tipo_leche.charAt(0).toUpperCase()+p.tipo_leche.slice(1)} (+$5)</div>` : ''}
      ${p.direccion ? `<div class="cocina-mesa" style="color:#2980b9;font-weight:600">📍 ${p.direccion}</div>` : ''}
      ${p.notas ? `<div class="cocina-mesa" style="color:#f39c12">📝 ${p.notas}</div>` : ''}
      ${p.comprobante_url ? `<div class="comp-badge" onclick="verComprobante('${p.comprobante_url}')">🧾 Ver comprobante</div>` : ''}
      <div style="margin:.5rem 0;font-size:.85rem">${items}</div>
      <div style="font-weight:700;color:#f1c40f;margin-bottom:.5rem">Total: $${Number(p.total).toFixed(2)}</div>
      <div class="cocina-actions">${botones}</div>
    </div>
  `;
}

function botonesTablero(p) {
  const { id, estado } = p;
  if (estado === 'pendiente') return `
    <button class="btn-confirmar" onclick="cambiarEstadoTablero(${id},'confirmado')">✔ Confirmar</button>
    <button class="btn-cancelar" onclick="cambiarEstadoTablero(${id},'cancelado')">✕ Cancelar</button>
  `;
  if (estado === 'confirmado') return `
    <button class="btn-preparar" onclick="cambiarEstadoTablero(${id},'en_preparacion')">🔥 Preparar</button>
    <button class="btn-cancelar" onclick="cambiarEstadoTablero(${id},'cancelado')">✕ Cancelar</button>
  `;
  if (estado === 'en_preparacion') return `
    <div class="tiempo-selector">
      <span class="tiempo-label">⏱ Tiempo estimado de entrega:</span>
      <div class="tiempo-pills">
        ${[10,15,20,25,30,35,40].map(m =>
          `<button class="pill-tiempo" onclick="selTiempo(${id},${m},this)">${m}</button>`
        ).join('')}
        <span class="tiempo-min-label">min</span>
      </div>
    </div>
    <button class="btn-listo" onclick="cambiarEstadoTablero(${id},'listo')">✅ Listo</button>
  `;
  if (estado === 'listo') return `
    <button class="btn-entregar" onclick="cambiarEstadoTablero(${id},'entregado')">📦 Entregar</button>
  `;
  if (estado === 'entregado') return `
    <span style="color:#718096;font-size:.76rem;font-weight:600">✅ Completado</span>
    ${p.metodo_pago === 'efectivo' ? `<button class="btn-wp-comp" onclick="generarComprobanteImagen(pedidos[${id}])">📱 Comprobante</button>` : ''}
  `;
  return '';
}

async function cambiarEstadoTablero(id, estado) {
  const body = { estado };
  if (estado === 'listo' && _tiempoEstimado[id]) {
    body.tiempo_estimado = _tiempoEstimado[id];
    delete _tiempoEstimado[id];
  }
  const res = await fetch(`/api/pedidos/${id}/estado`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const { data } = await res.json();
    pedidos[id] = data;
    renderTablero();
  }
}

// ── Pedidos (lista) ───────────────────────────────────────────
async function cargarPedidos() {
  const fecha = document.getElementById('filtroPedidoFecha').value;
  const estado = document.getElementById('filtroPedidoEstado').value;
  let url = '/api/pedidos?';
  if (fecha) url += `fecha=${fecha}&`;
  if (estado) url += `estado=${estado}`;

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 401) { cerrarSesion(); return; }
  const { data } = await res.json();
  const tbody = document.getElementById('bodyPedidos');

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay pedidos</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const hora = new Date(p.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `
      <tr>
        <td><strong>${p.numero_pedido}</strong></td>
        <td>${p.cliente_nombre}<br><small>${p.cliente_telefono}</small></td>
        <td>${iconoPago(p.metodo_pago)}</td>
        <td><strong>$${Number(p.total).toFixed(2)}</strong></td>
        <td><span class="estado-badge estado-${p.estado}">${etiquetaEstado(p.estado)}</span></td>
        <td>${hora}</td>
        <td style="display:flex;gap:.3rem;flex-wrap:wrap">
          <button class="btn-accion btn-ver" onclick="verDetalle(${p.id})">👁 Ver</button>
        </td>
      </tr>
    `;
  }).join('');
}

function etiquetaEstado(e) {
  return { pendiente:'Pendiente', confirmado:'Confirmado', en_preparacion:'En Prep.', listo:'Listo', entregado:'Entregado', cancelado:'Cancelado' }[e] || e;
}

function iconoPago(m) {
  return { efectivo:'💵 Efectivo', transferencia:'📱 Transferencia' }[m] || '💵 Efectivo';
}

function verComprobante(url) {
  window.open(url, '_blank');
}

// ── Detalle de pedido ─────────────────────────────────────────
let _pedidoDetalle = null;

async function verDetalle(id) {
  const res = await fetch(`/api/pedidos/${id}`, { headers: authHeader() });
  const { data: p } = await res.json();
  _pedidoDetalle = p;

  document.getElementById('modalTitulo').textContent = `Pedido #${p.numero_pedido}`;
  document.getElementById('modalCuerpo').innerHTML = `
    <p><strong>Cliente:</strong> ${p.cliente_nombre} | ${p.cliente_telefono}</p>
    ${p.tipo_leche ? `<p style="color:#7C3AED;font-weight:600"><strong>🥛 Leche:</strong> ${p.tipo_leche === 'carnation' ? 'Leche Carnation' : 'Leche Condensada'}</p>` : ''}
    ${p.direccion ? `<p style="color:#2471a3"><strong>📍 Dirección:</strong> ${p.direccion}</p>` : ''}
    <p><strong>Método de pago:</strong> ${iconoPago(p.metodo_pago)}</p>
    ${p.notas ? `<p><strong>Notas:</strong> ${p.notas}</p>` : ''}
    ${p.comprobante_url ? `
      <div style="margin:.8rem 0">
        <p style="font-weight:600;margin-bottom:.4rem">🧾 Comprobante de transferencia:</p>
        <a href="${p.comprobante_url}" target="_blank">
          <img src="${p.comprobante_url}" alt="Comprobante"
               style="max-width:100%;max-height:280px;object-fit:contain;border-radius:10px;border:2px solid #e0e0e0;cursor:zoom-in;display:block" />
        </a>
        <p style="font-size:.75rem;color:#888;margin-top:.3rem">Clic en la imagen para verla en tamaño completo</p>
      </div>` : ''}
    <div class="detalle-items">
      ${(p.items||[]).map(i => `
        <div class="detalle-item">
          <span>${i.cantidad}x ${i.nombre}</span>
          <span>$${Number(i.subtotal).toFixed(2)}</span>
        </div>`).join('')}
    </div>
    <div class="detalle-total"><span>Total</span><span>$${Number(p.total).toFixed(2)}</span></div>
  `;

  const colores = { confirmado:'#2980b9', en_preparacion:'#c0392b', listo:'#27ae60', entregado:'#888', cancelado:'#e74c3c' };
  const siguientes = { pendiente:['confirmado','cancelado'], confirmado:['en_preparacion','cancelado'], en_preparacion:['listo','cancelado'], listo:['entregado'] }[p.estado] || [];

  const botonesEstado = siguientes.map(s =>
    `<button style="background:${colores[s]};color:white" onclick="cambiarEstadoDesdeModal(${p.id},'${s}')">${etiquetaEstado(s)}</button>`
  ).join('');

  const btnComp = (p.estado === 'entregado' || p.estado === 'listo') && p.metodo_pago === 'efectivo'
    ? `<button style="background:#25D366;color:white;border:none;padding:.48rem 1rem;border-radius:50px;cursor:pointer;font-weight:600;font-size:.83rem;font-family:Poppins,sans-serif;box-shadow:0 3px 10px rgba(37,211,102,.35)" onclick="cerrarModalDetalle();generarComprobanteImagen(_pedidoDetalle)">📱 Comprobante</button>`
    : '';

  document.getElementById('estadoAcciones').innerHTML = botonesEstado + btnComp;

  document.getElementById('modalDetalle').classList.add('visible');
}

async function cambiarEstadoDesdeModal(id, estado) {
  await cambiarEstadoTablero(id, estado);
  cerrarModalDetalle();
  cargarPedidos();
}

function cerrarModalDetalle() {
  document.getElementById('modalDetalle').classList.remove('visible');
}

// ── Comprobantes de transferencia ─────────────────────────────
async function cargarComprobantes() {
  const fecha = document.getElementById('filtroCompFecha').value;
  let url = '/api/pedidos?';
  if (fecha) url += `fecha=${fecha}`;

  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 401) { cerrarSesion(); return; }
  const { data: todos } = await res.json();

  // Solo pedidos con transferencia Y comprobante subido
  const data = (todos || []).filter(p => p.metodo_pago === 'transferencia' && p.comprobante_url);

  const totalMonto  = data.reduce((s, p) => s + Number(p.total), 0);
  const pendientes  = data.filter(p => ['pendiente','confirmado','en_preparacion'].includes(p.estado)).length;

  document.getElementById('resumenDia').innerHTML = `
    <div class="resumen-card"><div class="valor">${data.length}</div><div class="etiqueta">Transferencias</div></div>
    <div class="resumen-card"><div class="valor">$${totalMonto.toFixed(2)}</div><div class="etiqueta">Monto total</div></div>
    <div class="resumen-card"><div class="valor">${pendientes}</div><div class="etiqueta">Por verificar</div></div>
  `;

  const tbody = document.getElementById('bodyComprobantes');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sin comprobantes de transferencia</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => {
    const hora = new Date(p.creado_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    return `
      <tr>
        <td><strong>${p.numero_pedido}</strong></td>
        <td>${p.cliente_nombre}<br><small style="color:#94A3B8">${p.cliente_telefono}</small></td>
        <td><strong>$${Number(p.total).toFixed(2)}</strong></td>
        <td><span class="estado-badge estado-${p.estado}">${etiquetaEstado(p.estado)}</span></td>
        <td>
          <a href="${p.comprobante_url}" target="_blank" title="Ver comprobante completo">
            <img src="${p.comprobante_url}"
                 style="height:52px;width:40px;object-fit:cover;border-radius:7px;border:1.5px solid #E2E8F0;cursor:zoom-in;display:block;transition:transform .2s"
                 onmouseover="this.style.transform='scale(1.08)'"
                 onmouseout="this.style.transform=''"  />
          </a>
        </td>
        <td style="font-size:.82rem;color:#64748B">${hora}</td>
        <td><button class="btn-accion btn-wp-comp" onclick="generarComprobanteDesdeId(${p.id})">📱 Comprobante</button></td>
      </tr>
    `;
  }).join('');
}

// ── Tiempo estimado de entrega ────────────────────────────────
const _tiempoEstimado = {};

function selTiempo(id, min, btn) {
  _tiempoEstimado[id] = min;
  btn.closest('.tiempo-pills').querySelectorAll('.pill-tiempo').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
}

// ── Comprobante imagen ────────────────────────────────────────
let _compBlob = null;
let _compTel  = '';

async function generarComprobanteImagen(p) {
  // Poblar plantilla
  document.getElementById('reciboNumero').textContent = `#${p.numero_pedido}`;
  document.getElementById('reciboFecha').textContent  =
    new Date(p.creado_en).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  document.getElementById('reciboDatos').innerHTML = [
    `<div class="recibo-fila"><span>Cliente</span><span>${p.cliente_nombre}</span></div>`,
    `<div class="recibo-fila"><span>Teléfono</span><span>${p.cliente_telefono}</span></div>`,
    p.direccion ? `<div class="recibo-fila"><span>Dirección</span><span>${p.direccion}</span></div>` : '',
    `<div class="recibo-fila"><span>Pago</span><span>${p.metodo_pago === 'transferencia' ? '📱 Transferencia' : '💵 Efectivo'}</span></div>`,
    p.tipo_leche ? `<div class="recibo-fila"><span>Leche</span><span>${p.tipo_leche === 'carnation' ? 'Leche Carnation' : 'Leche Condensada'}</span></div>` : '',
  ].join('');

  document.getElementById('reciboItems').innerHTML = (p.items || []).map(i =>
    `<div class="recibo-item"><span>${i.cantidad}x ${i.nombre}</span><span>$${Number(i.subtotal).toFixed(2)}</span></div>`
  ).join('');

  document.getElementById('reciboTotal').innerHTML =
    `<div class="recibo-total-row"><span>TOTAL</span><span>$${Number(p.total).toFixed(2)}</span></div>`;

  _compTel = (p.cliente_telefono || '').replace(/\D/g, '');

  const el = document.querySelector('#reciboRender .recibo-card');
  try {
    const canvas = await html2canvas(el, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });

    // Preview en modal
    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.style.cssText = 'max-width:100%;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.14)';
    const preview = document.getElementById('reciboPreview');
    preview.innerHTML = '';
    preview.appendChild(img);

    // Blob para compartir
    canvas.toBlob(blob => { _compBlob = blob; }, 'image/png');

    // Botón descargar
    document.getElementById('btnDescargarComp').onclick = () => {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `comprobante-${p.numero_pedido}.png`;
      a.click();
    };

    // Botón WhatsApp
    document.getElementById('btnEnviarWA').onclick = async () => {
      if (!_compBlob) return;
      const btn = document.getElementById('btnEnviarWA');
      btn.disabled = true;
      btn.textContent = 'Abriendo...';

      const phone   = _compTel.replace(/\D/g, '');
      const phoneWA = phone.startsWith('52') ? phone : `52${phone}`;
      const file    = new File([_compBlob], `comp-${p.numero_pedido}.png`, { type: 'image/png' });
      const esMobil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      try {
        if (esMobil && navigator.canShare && navigator.canShare({ files: [file] })) {
          // Móvil: compartir imagen directamente — en WhatsApp busca al cliente por su número
          toast(`📱 Selecciona WhatsApp → busca el número: ${_compTel}`, 'info', 10000);
          await navigator.share({ files: [file], text: 'Comprobante KORU 🧾' });
          cerrarModalComprobante();
        } else {
          // PC: copiar imagen al portapapeles y abrir chat directo
          let copiada = false;
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': _compBlob })]);
            copiada = true;
          } catch { /* sin acceso al portapapeles */ }

          if (!copiada) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(_compBlob);
            a.download = `comp-${p.numero_pedido}.png`;
            a.click();
          }

          window.open(`https://wa.me/${phoneWA}`, '_blank');
          toast(
            copiada
              ? '✅ Chat abierto · Pega la imagen con Ctrl+V y envía'
              : '✅ Chat abierto · La imagen se descargó, adjúntala',
            'success', 8000
          );
          cerrarModalComprobante();
        }
      } catch (err) {
        if (err.name !== 'AbortError') toast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📱 Enviar por WhatsApp';
      }
    };

    document.getElementById('modalComprobante').classList.add('visible');
  } catch (err) {
    toast('Error generando imagen: ' + err.message, 'error');
  }
}

async function generarComprobanteDesdeId(pedidoId) {
  const res = await fetch(`/api/pedidos/${pedidoId}`, { headers: authHeader() });
  const { data: p } = await res.json();
  await generarComprobanteImagen(p);
}

function cerrarModalComprobante() {
  document.getElementById('modalComprobante').classList.remove('visible');
}

// ── Helpers ───────────────────────────────────────────────────
function setEstado(texto) { document.getElementById('estadoConexion').textContent = texto; }

function notificarNuevoPedido(numero) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🛒 Nuevo pedido', { body: `Pedido #${numero} recibido` });
  }
}

function actualizarReloj() {
  const el = document.getElementById('fechaHora');
  if (el) el.textContent = new Date().toLocaleTimeString('es-ES');
}

// ── Inicio ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const infoEl = document.getElementById('usuarioInfo');
  if (infoEl && usuarioActual) infoEl.textContent = `👤 ${usuarioActual.nombre}`;
});

if ('Notification' in window) Notification.requestPermission();
setInterval(actualizarReloj, 1000);
setInterval(renderTablero, 30000);
actualizarReloj();

function fechaLocalHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

document.getElementById('filtroPedidoFecha').value = fechaLocalHoy();
document.getElementById('filtroCompFecha').value   = fechaLocalHoy();

iniciarTablero();
