const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const dir = path.join(__dirname, '../../../uploads/comprobantes');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `comp_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB máximo
  fileFilter: (_req, file, cb) => {
    const permitidos = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF'));
  },
});

// Multer para comprobantes generados por el admin (imagen PNG del ticket)
const dirGen = path.join(__dirname, '../../../uploads/comprobantes-generados');
if (!fs.existsSync(dirGen)) fs.mkdirSync(dirGen, { recursive: true });

const storageGen = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dirGen),
  filename:    (_req, _file, cb) => cb(null, `gen_${Date.now()}.png`),
});
const uploadGenerado = multer({
  storage: storageGen,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

module.exports = upload;
module.exports.generado = uploadGenerado;
