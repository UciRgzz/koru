const API = '';
let carrito = [];
let productos = [];
let metodoPago = 'efectivo';

function seleccionarMetodo(btn, metodo) {
  document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  metodoPago = metodo;
  const box = document.getElementById('transferenciaBox');
  if (box) box.classList.toggle('hidden', metodo !== 'transferencia');
  actualizarBotonEnvio();
}

function previsualizarComprobante(input) {
  const preview = document.getElementById('comprobantePreview');
  const texto   = document.getElementById('uploadTexto');
  const file    = input.files[0];
  if (!file) return;
  texto.textContent = `✅ ${file.name}`;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else {
    preview.classList.add('hidden');
  }
  actualizarBotonEnvio();
}

function actualizarBotonEnvio() {
  const btn   = document.getElementById('btnPedido');
  const aviso = document.getElementById('avisoComprobante');
  if (!btn) return;

  if (metodoPago === 'transferencia') {
    const archivo = document.getElementById('comprobanteFile')?.files[0];
    if (!archivo) {
      btn.disabled = true;
      btn.style.opacity = '.45';
      btn.style.cursor  = 'not-allowed';
      if (aviso) aviso.classList.remove('hidden');
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor  = '';
      if (aviso) aviso.classList.add('hidden');
    }
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor  = '';
    if (aviso) aviso.classList.add('hidden');
  }
}

// ── Carga inicial ──────────────────────────────────────────────
async function init() {
  await cargarCategorias();
  await cargarProductos();
}

async function cargarCategorias() {
  const res = await fetch(`${API}/api/menu/categorias`);
  const { data } = await res.json();
  const nav = document.getElementById('categoriasNav');
  data.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.id = cat.id;
    btn.textContent = `${cat.icono} ${cat.nombre}`;
    btn.onclick = () => filtrarCategoria(cat.id, btn);
    nav.appendChild(btn);
  });
}

async function cargarProductos(categoriaId = '') {
  const grid = document.getElementById('productosGrid');
  grid.innerHTML = '<div class="loading">Cargando productos...</div>';
  const url = categoriaId ? `${API}/api/menu/productos?categoria_id=${categoriaId}` : `${API}/api/menu/productos`;
  const res = await fetch(url);
  const { data } = await res.json();
  productos = data;
  renderProductos(data);
}

function renderProductos(lista) {
  const grid = document.getElementById('productosGrid');
  if (!lista.length) { grid.innerHTML = '<div class="loading">No hay productos disponibles</div>'; return; }
  grid.innerHTML = lista.map(p => {
    const bullets = (p.descripcion || '').split('|').filter(Boolean);
    const descHTML = bullets.length > 1
      ? `<ul class="card-features">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
      : `<p class="card-desc">${p.descripcion || ''}</p>`;
    return `
    <div class="producto-card">
      <div class="card-img">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy">`
          : '🧋'}
      </div>
      <div class="card-flavor-bar"></div>
      <div class="card-body">
        <h3>${p.nombre}</h3>
        ${descHTML}
        <div class="card-footer">
          <span class="precio">$${Number(p.precio).toFixed(2)}</span>
          <button class="btn-agregar" onclick="agregarAlCarrito(${p.id})" title="Agregar al carrito">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filtrarCategoria(id, btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarProductos(id);
}

// ── Carrito ────────────────────────────────────────────────────
function agregarAlCarrito(productoId) {
  const prod = productos.find(p => p.id === productoId);
  if (!prod) return;
  const existente = carrito.find(i => i.producto_id === productoId);
  if (existente) {
    existente.cantidad++;
  } else {
    carrito.push({ producto_id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: 1 });
  }
  actualizarUI();
}

function cambiarCantidad(productoId, delta) {
  const item = carrito.find(i => i.producto_id === productoId);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(i => i.producto_id !== productoId);
  actualizarUI();
}

function actualizarUI() {
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);

  document.getElementById('badgeCarrito').textContent = totalItems;
  document.getElementById('totalPrecio').textContent = `$${total.toFixed(2)}`;

  const container = document.getElementById('carritoItems');
  if (!carrito.length) {
    container.innerHTML = '<p class="carrito-vacio">Tu carrito está vacío</p>';
    return;
  }
  container.innerHTML = carrito.map(item => `
    <div class="carrito-item">
      <span class="item-nombre">${item.nombre}</span>
      <div class="item-controles">
        <button class="btn-cantidad" onclick="cambiarCantidad(${item.producto_id}, -1)">−</button>
        <span class="item-cantidad">${item.cantidad}</span>
        <button class="btn-cantidad" onclick="cambiarCantidad(${item.producto_id}, 1)">+</button>
      </div>
      <span class="item-subtotal">$${(item.precio * item.cantidad).toFixed(2)}</span>
    </div>
  `).join('');
}

// ── Panel carrito ─────────────────────────────────────────────
function abrirCarrito() {
  document.getElementById('carritoPanel').classList.add('abierto');
  document.getElementById('overlay').classList.add('visible');
}
function cerrarCarrito() {
  document.getElementById('carritoPanel').classList.remove('abierto');
  document.getElementById('overlay').classList.remove('visible');
}

// ── Enviar pedido ─────────────────────────────────────────────
async function enviarPedido() {
  const nombre     = document.getElementById('clienteNombre').value.trim();
  const telefono   = document.getElementById('clienteTelefono').value.trim();
  const direccion  = document.getElementById('clienteDireccion').value.trim();
  const notas      = document.getElementById('clienteNotas').value.trim();

  if (!nombre || !telefono) { toast('Por favor ingresa tu nombre y teléfono.', 'warning'); return; }
  if (!direccion) { toast('Por favor ingresa la dirección de entrega.', 'warning'); return; }
  if (!carrito.length) { toast('Tu carrito está vacío.', 'warning'); return; }

  const btn = document.getElementById('btnPedido');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    // Validar comprobante si es transferencia
    if (metodoPago === 'transferencia') {
      const archivo = document.getElementById('comprobanteFile')?.files[0];
      if (!archivo) {
        toast('Por favor sube tu comprobante de transferencia.', 'warning');
        btn.disabled = false; btn.textContent = 'Enviar Pedido';
        return;
      }
    }

    // Siempre FormData para soportar archivos adjuntos
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('telefono', telefono);
    formData.append('direccion', direccion);
    formData.append('metodo_pago', metodoPago);
    if (notas) formData.append('notas', notas);
    formData.append('items', JSON.stringify(
      carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad }))
    ));

    if (metodoPago === 'transferencia') {
      formData.append('comprobante', document.getElementById('comprobanteFile').files[0]);
    }

    const res = await fetch(`${API}/api/pedidos`, {
      method: 'POST',
      body: formData, // Sin Content-Type: el browser lo pone automático con boundary
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.mensaje);

    // Redirigir a la página de seguimiento
    const numero = json.data.numero_pedido;
    window.location.href = `/tracking?pedido=${encodeURIComponent(numero)}&nombre=${encodeURIComponent(nombre)}`;
  } catch (err) {
    toast(`Error al enviar el pedido: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Enviar Pedido';
  }
}

init();
