const router = require('express').Router();
const { guardarSuscripcion, guardarSuscripcionAdmin } = require('../services/pushService');
const { verificarToken } = require('../middleware/auth');

// Devuelve la clave pública VAPID al frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Guarda la suscripción push asociada al pedido
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, numeroPedido } = req.body;
    if (!subscription || !numeroPedido) {
      return res.status(400).json({ ok: false, mensaje: 'Faltan datos' });
    }
    await guardarSuscripcion(numeroPedido, subscription);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
});

// Suscribe al admin para recibir push cuando llegue un pedido nuevo
router.post('/subscribe-admin', verificarToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ ok: false, mensaje: 'Falta suscripción' });
    await guardarSuscripcionAdmin(req.usuario.id, subscription);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: err.message });
  }
});

module.exports = router;
