const ExcelJS = require('exceljs');
const db = require('../config/database');

// Estados que se consideran "cerrados" y pueden borrarse de forma segura.
// Los pedidos activos (pendiente/confirmado/en_preparacion/listo) nunca se tocan.
const ESTADOS_CERRADOS = ['entregado', 'cancelado'];

async function descargarReporteSemanal(req, res) {
  try {
    const { rows: pedidos } = await db.query(
      `SELECT p.id, p.numero_pedido, p.creado_en, p.estado, p.metodo_pago, p.total,
              p.direccion, p.notas, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM pedidos p JOIN clientes c ON p.cliente_id = c.id
       ORDER BY p.creado_en ASC`
    );

    const { rows: items } = await db.query(
      `SELECT pi.pedido_id, pr.nombre AS producto, pi.cantidad, pi.precio_unitario, pi.subtotal
       FROM pedido_items pi JOIN productos pr ON pi.producto_id = pr.id
       ORDER BY pi.pedido_id ASC`
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'KORU';
    wb.created = new Date();

    const hojaPedidos = wb.addWorksheet('Pedidos');
    hojaPedidos.columns = [
      { header: 'N° Pedido',  key: 'numero_pedido',    width: 18 },
      { header: 'Fecha',      key: 'creado_en',        width: 20 },
      { header: 'Cliente',    key: 'cliente_nombre',   width: 24 },
      { header: 'Teléfono',   key: 'cliente_telefono', width: 16 },
      { header: 'Dirección',  key: 'direccion',        width: 30 },
      { header: 'Método pago',key: 'metodo_pago',      width: 14 },
      { header: 'Estado',     key: 'estado',           width: 16 },
      { header: 'Total',      key: 'total',            width: 12 },
      { header: 'Notas',      key: 'notas',            width: 24 },
    ];
    hojaPedidos.getRow(1).font = { bold: true };
    pedidos.forEach(p => hojaPedidos.addRow({
      ...p,
      creado_en: new Date(p.creado_en).toLocaleString('es-MX', { timeZone: 'America/Monterrey' }),
      total: Number(p.total),
    }));

    const hojaDetalle = wb.addWorksheet('Detalle de productos');
    hojaDetalle.columns = [
      { header: 'ID Pedido',        key: 'pedido_id',       width: 12 },
      { header: 'Producto',         key: 'producto',        width: 26 },
      { header: 'Cantidad',         key: 'cantidad',        width: 12 },
      { header: 'Precio unitario',  key: 'precio_unitario', width: 16 },
      { header: 'Subtotal',         key: 'subtotal',        width: 14 },
    ];
    hojaDetalle.getRow(1).font = { bold: true };
    items.forEach(it => hojaDetalle.addRow({
      ...it,
      precio_unitario: Number(it.precio_unitario),
      subtotal: Number(it.subtotal),
    }));

    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="koru-reporte-${fecha}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function limpiarPedidosCerrados(req, res) {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN');

    const { rows: aBorrar } = await conn.query(
      `SELECT id FROM pedidos WHERE estado = ANY($1::varchar[])`,
      [ESTADOS_CERRADOS]
    );
    const ids = aBorrar.map(r => r.id);

    if (!ids.length) {
      await conn.query('ROLLBACK');
      return res.json({ ok: true, borrados: 0, mensaje: 'No hay pedidos cerrados para borrar.' });
    }

    await conn.query('DELETE FROM pedido_items WHERE pedido_id = ANY($1::int[])', [ids]);
    await conn.query('DELETE FROM pedidos WHERE id = ANY($1::int[])', [ids]);

    await conn.query('COMMIT');
    res.json({ ok: true, borrados: ids.length, mensaje: `${ids.length} pedido(s) cerrado(s) eliminado(s) correctamente.` });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ ok: false, mensaje: err.message });
  } finally {
    conn.release();
  }
}

module.exports = { descargarReporteSemanal, limpiarPedidosCerrados };
