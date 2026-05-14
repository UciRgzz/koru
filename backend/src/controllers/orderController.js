const db = require('../config/database');
const { notificarCliente, notificarAdmin } = require('../services/pushService');
const { enviarImagenWhatsApp } = require('../services/twilioService');

function generarNumeroPedido() {
  const fecha = new Date();
  const prefijo = `P${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefijo}-${random}`;
}

async function crearPedido(req, res) {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    const { nombre, telefono, notas, metodo_pago, direccion, tipo_leche, extra_leche } = req.body;
    // items llega como JSON string cuando se envía con FormData
    const items = typeof req.body.items === 'string'
      ? JSON.parse(req.body.items)
      : (req.body.items || []);

    if (!nombre || !telefono || !items?.length) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre, teléfono e items son requeridos' });
    }

    // Validar comprobante obligatorio si paga por transferencia
    if (metodo_pago === 'transferencia' && !req.file) {
      return res.status(400).json({ ok: false, mensaje: 'Debes subir el comprobante de transferencia' });
    }

    const comprobanteUrl = req.file ? `/uploads/comprobantes/${req.file.filename}` : null;

    // Buscar o crear cliente
    const { rows: clientes } = await conn.query(
      'SELECT * FROM clientes WHERE telefono = $1', [telefono]
    );
    let clienteId;
    if (clientes.length) {
      clienteId = clientes[0].id;
      await conn.query('UPDATE clientes SET nombre = $1 WHERE id = $2', [nombre, clienteId]);
    } else {
      const { rows } = await conn.query(
        'INSERT INTO clientes (nombre, telefono) VALUES ($1, $2) RETURNING id',
        [nombre, telefono]
      );
      clienteId = rows[0].id;
    }

    // Calcular total verificando precios en BD
    let total = 0;
    const itemsDetalle = [];
    for (const item of items) {
      const { rows: prods } = await conn.query(
        'SELECT * FROM productos WHERE id = $1 AND disponible = TRUE', [item.producto_id]
      );
      if (!prods.length) {
        await conn.query('ROLLBACK');
        return res.status(400).json({ ok: false, mensaje: `Producto ${item.producto_id} no disponible` });
      }
      const prod = prods[0];
      const subtotal = prod.precio * item.cantidad;
      total += subtotal;
      itemsDetalle.push({
        producto_id: prod.id,
        cantidad: item.cantidad,
        precio_unitario: prod.precio,
        subtotal,
        notas: item.notas || null,
      });
    }

    // Agregar cargo por leche especial
    const cargoLeche = parseFloat(extra_leche) || 0;
    if (cargoLeche > 0) total += cargoLeche;

    // Crear pedido
    const numeroPedido = generarNumeroPedido();
    const metodosValidos = ['efectivo', 'tarjeta', 'transferencia'];
    const metodoPagoFinal = metodosValidos.includes(metodo_pago) ? metodo_pago : 'efectivo';

    const { rows: pedidoRows } = await conn.query(
      'INSERT INTO pedidos (numero_pedido, cliente_id, notas, total, metodo_pago, comprobante_url, direccion, tipo_leche) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [numeroPedido, clienteId, notas || null, total, metodoPagoFinal, comprobanteUrl, direccion || null, tipo_leche || null]
    );
    const pedidoId = pedidoRows[0].id;

    // Insertar items
    for (const it of itemsDetalle) {
      await conn.query(
        'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas) VALUES ($1,$2,$3,$4,$5,$6)',
        [pedidoId, it.producto_id, it.cantidad, it.precio_unitario, it.subtotal, it.notas]
      );
    }

    await conn.query('COMMIT');

    const pedidoCompleto = await getPedidoCompleto(pedidoId);
    const io = req.app.get('io');
    io.to('cocina').emit('nuevo_pedido', pedidoCompleto);
    io.to('admin').emit('nuevo_pedido', pedidoCompleto);

    notificarAdmin(pedidoCompleto);

    res.status(201).json({ ok: true, data: pedidoCompleto });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ ok: false, mensaje: err.message });
  } finally {
    conn.release();
  }
}

async function getPedidos(req, res) {
  try {
    const { estado, fecha } = req.query;
    let sql = `
      SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); sql += ` AND p.estado = $${params.length}`; }
    if (fecha)  { params.push(fecha);  sql += ` AND DATE(p.creado_en) = $${params.length}`; }
    sql += ' ORDER BY p.creado_en DESC';

    const { rows } = await db.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getPedido(req, res) {
  try {
    const pedido = await getPedidoCompleto(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    res.json({ ok: true, data: pedido });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { estado, tiempo_estimado } = req.body;
    const estadosValidos = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado no válido' });
    }

    let rowCount;
    if (tiempo_estimado) {
      ({ rowCount } = await db.query(
        'UPDATE pedidos SET estado = $1, tiempo_estimado = $2 WHERE id = $3',
        [estado, tiempo_estimado, req.params.id]
      ));
    } else {
      ({ rowCount } = await db.query(
        'UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, req.params.id]
      ));
    }
    if (!rowCount) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });

    const pedidoActualizado = await getPedidoCompleto(req.params.id);
    const io = req.app.get('io');
    io.to('cocina').emit('estado_pedido', pedidoActualizado);
    io.to('admin').emit('estado_pedido', pedidoActualizado);
    // Notifica a la página de seguimiento del cliente (socket)
    io.to(`pedido_${pedidoActualizado.numero_pedido}`).emit('estado_pedido', pedidoActualizado);

    // Notificación push externa (llega aunque el celular esté bloqueado)
    notificarCliente(pedidoActualizado);

    res.json({ ok: true, data: pedidoActualizado });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getEstadoPedido(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT p.numero_pedido, p.estado, p.tiempo_estimado, c.nombre AS cliente_nombre
       FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
       WHERE p.numero_pedido = $1`,
      [req.params.numero]
    );
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getPedidoCompleto(pedidoId) {
  const { rows: pedidos } = await db.query(
    `SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
     FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
     WHERE p.id = $1`,
    [pedidoId]
  );
  if (!pedidos.length) return null;

  const { rows: items } = await db.query(
    `SELECT pi.*, pr.nombre, pr.imagen_url
     FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id
     WHERE pi.pedido_id = $1`,
    [pedidoId]
  );

  return { ...pedidos[0], items };
}

async function enviarComprobanteImagen(req, res) {
  try {
    const pedido = await getPedidoCompleto(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    if (!req.file)  return res.status(400).json({ ok: false, mensaje: 'No se recibió imagen' });

    const base    = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const mediaUrl = `${base}/uploads/comprobantes-generados/${req.file.filename}`;
    const caption  = `🧋 Comprobante de tu pedido *#${pedido.numero_pedido}* – KORU\n¡Gracias por tu compra!`;

    await enviarImagenWhatsApp(pedido.cliente_telefono, mediaUrl, caption);
    res.json({ ok: true, mensaje: 'Comprobante enviado por WhatsApp' });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getRecibo(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT p.numero_pedido, p.estado, p.total, p.metodo_pago, p.tipo_leche,
              p.direccion, p.notas, p.creado_en,
              c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
       WHERE p.numero_pedido = $1 AND p.estado IN ('entregado','listo')`,
      [req.params.numero]
    );
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Recibo no disponible' });

    const { rows: items } = await db.query(
      `SELECT pi.cantidad, pi.precio_unitario, pr.nombre
       FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id
       WHERE pi.pedido_id = (SELECT id FROM pedidos WHERE numero_pedido = $1)`,
      [req.params.numero]
    );

    res.json({ ok: true, data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

module.exports = { crearPedido, getPedidos, getPedido, actualizarEstado, getEstadoPedido, enviarComprobanteImagen, getRecibo };
