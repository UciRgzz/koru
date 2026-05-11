const router = require('express').Router();
const { registrarPago, getComprobante, getComprobantes, reenviarWhatsapp } = require('../controllers/paymentController');

router.post('/', registrarPago);
router.get('/', getComprobantes);
router.get('/:id', getComprobante);
router.post('/:id/reenviar', reenviarWhatsapp);

module.exports = router;
