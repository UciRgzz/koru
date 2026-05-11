const router = require('express').Router();
const { login, cambiarPassword, crearUsuario } = require('../controllers/authController');
const { verificarToken, soloAdmin } = require('../middleware/auth');

router.post('/login', login);
router.put('/password', verificarToken, cambiarPassword);
router.post('/usuarios', verificarToken, soloAdmin, crearUsuario);

module.exports = router;
