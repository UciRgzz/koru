const db = require('../config/database');

async function getCategorias(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM categorias WHERE activo = TRUE ORDER BY orden ASC'
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getProductos(req, res) {
  try {
    const { categoria_id } = req.query;
    let sql = `
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      WHERE p.disponible = TRUE
    `;
    const params = [];
    if (categoria_id) {
      params.push(categoria_id);
      sql += ` AND p.categoria_id = $${params.length}`;
    }
    sql += ' ORDER BY c.orden ASC, p.nombre ASC';
    const { rows } = await db.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function getProducto(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM productos WHERE id = $1 AND disponible = TRUE',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function toggleDisponible(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    const nuevoEstado = !rows[0].disponible;
    await db.query('UPDATE productos SET disponible = $1 WHERE id = $2', [nuevoEstado, req.params.id]);
    res.json({ ok: true, disponible: nuevoEstado });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

module.exports = { getCategorias, getProductos, getProducto, toggleDisponible };
