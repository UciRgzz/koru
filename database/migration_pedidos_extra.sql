-- Columnas que usa orderController.js pero faltaban en schema.sql
-- Ejecutar una sola vez sobre la base de datos

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia')),
  ADD COLUMN IF NOT EXISTS comprobante_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS tipo_leche VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tiempo_estimado INTEGER;
