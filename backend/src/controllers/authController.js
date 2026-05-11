const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurante_secret_2026';

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Email y contraseña requeridos' });
    }

    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      ok: true,
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function cambiarPassword(req, res) {
  try {
    const { password_actual, password_nuevo } = req.body;
    const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const valida = await bcrypt.compare(password_actual, rows[0].password);
    if (!valida) return res.status(400).json({ ok: false, mensaje: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(password_nuevo, 10);
    await db.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hash, req.usuario.id]);
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

async function crearUsuario(req, res) {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre, email y contraseña requeridos' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol',
      [nombre, email, hash, rol || 'cocina']
    );
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ ok: false, mensaje: 'El email ya está registrado' });
    res.status(500).json({ ok: false, mensaje: err.message });
  }
}

module.exports = { login, cambiarPassword, crearUsuario };
