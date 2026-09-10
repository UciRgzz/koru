const router  = require('express').Router();
const { crearPedido, getPedidos, getPedido, actualizarEstado, actualizarMetodoPago, getEstadoPedido, enviarComprobanteImagen, getRecibo } = require('../controllers/orderController');
const { descargarReporteSemanal, limpiarPedidosCerrados } = require('../controllers/reporteController');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const upload   = require('../middleware/upload');

// POST: público — acepta multipart (para subir comprobante de transferencia)
router.post('/', upload.single('comprobante'), crearPedido);

// GET estado por número de pedido: público — para la página de seguimiento del cliente
router.get('/status/:numero', getEstadoPedido);

// GET recibo público — solo disponible cuando el pedido está entregado
router.get('/recibo/:numero', getRecibo);

// Reporte semanal (Excel) y limpieza de pedidos cerrados: solo admin.
// Deben ir antes de '/:id' para que Express no confunda "reporte" con un id.
router.get('/reporte/semanal',    verificarToken, soloAdmin, descargarReporteSemanal);
router.delete('/reporte/semanal', verificarToken, soloAdmin, limpiarPedidosCerrados);

// GET y PATCH: solo admin autenticado
router.get('/',    verificarToken, getPedidos);
router.get('/:id', verificarToken, getPedido);
router.patch('/:id/estado',        verificarToken, actualizarEstado);
router.patch('/:id/metodo-pago',   verificarToken, actualizarMetodoPago);

// POST: enviar imagen del comprobante al cliente por WhatsApp (Twilio)
router.post('/:id/enviar-comprobante', verificarToken, upload.generado.single('imagen'), enviarComprobanteImagen);

module.exports = router;
