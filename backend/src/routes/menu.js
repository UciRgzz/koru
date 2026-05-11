const router = require('express').Router();
const { getCategorias, getProductos, getProducto, toggleDisponible } = require('../controllers/menuController');

router.get('/categorias', getCategorias);
router.get('/productos', getProductos);
router.get('/productos/:id', getProducto);
router.patch('/productos/:id/disponible', toggleDisponible);

module.exports = router;
