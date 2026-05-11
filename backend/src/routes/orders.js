const router  = require('express').Router();
const { crearPedido, getPedidos, getPedido, actualizarEstado, getEstadoPedido, enviarComprobanteImagen } = require('../controllers/orderController');
const { verificarToken } = require('../middleware/auth');
const upload   = require('../middleware/upload');

// POST: público — acepta multipart (para subir comprobante de transferencia)
router.post('/', upload.single('comprobante'), crearPedido);

// GET estado por número de pedido: público — para la página de seguimiento del cliente
router.get('/status/:numero', getEstadoPedido);

// GET y PATCH: solo admin autenticado
router.get('/',    verificarToken, getPedidos);
router.get('/:id', verificarToken, getPedido);
router.patch('/:id/estado', verificarToken, actualizarEstado);

// POST: enviar imagen del comprobante al cliente por WhatsApp (Twilio)
router.post('/:id/enviar-comprobante', verificarToken, upload.generado.single('imagen'), enviarComprobanteImagen);

module.exports = router;
