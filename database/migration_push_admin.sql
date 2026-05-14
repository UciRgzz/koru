-- Agregar columna push_subscription a usuarios (para notificaciones push al admin)
-- Ejecutar una sola vez en pgAdmin sobre restaurante_db

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_subscription TEXT;
