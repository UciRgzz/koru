-- ================================================================
-- KORU – Carga de productos reales
-- Ejecutar en pgAdmin sobre restaurante_db
-- ================================================================

-- Limpiar datos de ejemplo (respeta la tabla de pedidos existentes)
DELETE FROM pedido_items;
DELETE FROM comprobantes;
DELETE FROM pedidos;
DELETE FROM productos;
DELETE FROM categorias;

-- Reiniciar secuencias
ALTER SEQUENCE categorias_id_seq RESTART WITH 1;
ALTER SEQUENCE productos_id_seq  RESTART WITH 1;

-- ── Categoría ────────────────────────────────────────────────────
INSERT INTO categorias (nombre, descripcion, icono, orden) VALUES
  ('Tapiocas', 'Bebidas de tapioca estilo sago tailandés', '🧋', 1);

-- ── Productos KORU ───────────────────────────────────────────────
INSERT INTO productos (categoria_id, nombre, descripcion, precio, imagen_url, disponible) VALUES
  (1,
   'Tapioca de Fresa',
   'Hecha con ingredientes de calidad|Perlas suaves y deliciosas|Fresca, cremosa y natural',
   65.00,
   '/img/menu1.jpeg',
   TRUE),

  (1,
   'Tapioca de Mango',
   'Hecha con ingredientes de calidad|Perlas suaves y deliciosas|Fresca, cremosa y natural',
   65.00,
   '/img/menu2.jpeg',
   TRUE),

  (1,
   'Tapioca de Piña Colada',
   'Hecha con ingredientes de calidad|Perlas suaves y deliciosas|Cremosa, tropical y refrescante',
   70.00,
   '/img/menu3.jpeg',
   TRUE);
