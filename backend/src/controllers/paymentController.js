const db = require('../config/database');
const { enviarComprobante } = require('../services/twilioService');

function generarNumeroComprobante() {
  const fecha = new Date();
  const prefijo = `C${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `${prefijo}-${random}`;
}

async function registrarPago(req, res) {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');
    const { pedido_id, metodo_pago, monto_recibido } = req.body;

    if (!pedido_id || !metodo_pago) {
      return res.status(400).json({ ok: false, mensaje: 'pedido_id y metodo_pago son requeridos' });
    }

    // Verificar pedido
    const { rows: pedidos } = await conn.query(
      `SELECT p.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1`,
      [pedido_id]
    );
    if (!pedidos.length) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    const pedido = pedidos[0];

    if (pedido.estado === 'cancelado') {
      return res.status(400).json({ ok: false, mensaje: 'No se puede cobrar un pedido cancelado' });
    }

    // Verificar comprobante duplicado
    const { rows: existing } = await conn.query(
      'SELECT id FROM comprobantes WHERE pedido_id = $1', [pedido_id]
    );
    if (existing.length) {
      return res.status(400).json({ ok: false, mensaje: 'Este pedido ya tiene comprobante registrado' });
    }

    const montoRecibido = parseFloat(monto_recibido) || pedido.total;
    const cambio = Math.max(0, montoRecibido - pedido.total);
    const numeroComprobante = generarNumeroComprobante();

    const { rows: compRows } = await conn.query(
      `INSERT INTO comprobantes (pedido_id, numero_comprobante, monto_total, metodo_pago, monto_recibido, cambio)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [pedido_id, numeroComprobante, pedido.total, metodo_pago, montoRecibido, cambio]
    );
    const comprobante = compRows[0];

    // Marcar pedido como entregado
    await conn.query('UPDATE pedidos SET estado = $1 WHERE id = $2', ['entregado', pedido_id]);

    await conn.query('COMMIT');

    // Obtener items
    const { rows: items } = await db.query(
      `SELECT pi.*, pr.nombre FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id WHERE pi.pedido_id = $1`,
      [pedido_id]
    );

    // Enviar WhatsApp de forma asíncrona
    enviarComprobante(pedido.cliente_telefono, pedido, comprobante, items)
      .then(async (sid) => {
        await db.query(
          'UPDATE comprobantes SET whatsapp_enviado = TRUE, whatsapp_enviado_en = NOW() WHERE id = $1',
          [comprobante.id]
        );
        const io = req.app.get('io');
        io.to('admin').emit('whatsapp_enviado', { comprobanteId: comprobante.id, sid });
      })
      .catch(err => console.error('Error WhatsApp:', err.message));

    const io = req.app.get('io');
    io.to('cocina').emit('pedido_pagado', { pedido_id, numero_pedido: pedido.numero_pedido });
    io.to('admin').emit('pedido_pagado', { pedido_id, comprobante });

    res.status(201).json({ ok: true, data: { comprobante, pedido: { ...pedido, estado: 'entregado' }, items } });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ ok: false, mensaje: err.message });
  } finally {
    conn.release();
  }
}

async function getComprobante(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT c.*, p.numero_pedido, p.mesa, p.notas AS pedido_notas,
              cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
       FROM comprobantes c
       JOIN pedidos p ON c.pedido_id = p.id
       JOIN clientes cl ON p.cliente_id = cl.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Comprobante no encontrado' });

    const { rows: items } = await db.query(
      `SELECT pi.*, pr.nombre FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id WHERE pi.pedido_id = $1`,
      [rows[0].pedido_id]
    );

    res.json({ ok: true, data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getComprobantes(req, res) {
  try {
    const { fecha } = req.query;
    let sql = `
      SELECT c.*, p.numero_pedido, p.mesa, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
      FROM comprobantes c
      JOIN pedidos p ON c.pedido_id = p.id
      JOIN clientes cl ON p.cliente_id = cl.id
      WHERE 1=1
    `;
    const params = [];
    if (fecha) { params.push(fecha); sql += ` AND DATE(c.creado_en) = $${params.length}`; }
    sql += ' ORDER BY c.creado_en DESC';

    const { rows } = await db.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function reenviarWhatsapp(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT c.*, p.numero_pedido, p.mesa, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
       FROM comprobantes c
       JOIN pedidos p ON c.pedido_id = p.id
       JOIN clientes cl ON p.cliente_id = cl.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Comprobante no encontrado' });

    const comprobante = rows[0];
    const { rows: items } = await db.query(
      `SELECT pi.*, pr.nombre FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id WHERE pi.pedido_id = $1`,
      [comprobante.pedido_id]
    );

    const sid = await enviarComprobante(
      comprobante.cliente_telefono,
      { numero_pedido: comprobante.numero_pedido, mesa: comprobante.mesa },
      comprobante,
      items
    );
    await db.query(
      'UPDATE comprobantes SET whatsapp_enviado = TRUE, whatsapp_enviado_en = NOW() WHERE id = $1',
      [req.params.id]
    );

    res.json({ ok: true, mensaje: 'WhatsApp enviado', sid });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

module.exports = { registrarPago, getComprobante, getComprobantes, reenviarWhatsapp };
