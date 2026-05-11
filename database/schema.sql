-- =============================================
-- SISTEMA DE PEDIDOS - RESTAURANTE
-- Esquema para PostgreSQL
-- =============================================

CREATE DATABASE restaurante_db;

\c restaurante_db;

-- Categorías del menú
CREATE TABLE IF NOT EXISTS categorias (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  icono     VARCHAR(50) DEFAULT '🍽️',
  activo    BOOLEAN DEFAULT TRUE,
  orden     INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Productos del menú
CREATE TABLE IF NOT EXISTS productos (
  id           SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  precio       NUMERIC(10,2) NOT NULL,
  imagen_url   VARCHAR(500),
  disponible   BOOLEAN DEFAULT TRUE,
  creado_en    TIMESTAMP DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(150) NOT NULL,
  telefono  VARCHAR(20) NOT NULL,
  email     VARCHAR(150),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id             SERIAL PRIMARY KEY,
  numero_pedido  VARCHAR(20) NOT NULL UNIQUE,
  cliente_id     INTEGER NOT NULL REFERENCES clientes(id),
  mesa           VARCHAR(20),
  estado         VARCHAR(20) DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado')),
  total          NUMERIC(10,2) DEFAULT 0.00,
  notas          TEXT,
  creado_en      TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Trigger para actualizar actualizado_en automáticamente
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedidos_actualizado
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- Detalle de pedidos
CREATE TABLE IF NOT EXISTS pedido_items (
  id             SERIAL PRIMARY KEY,
  pedido_id      INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id    INTEGER NOT NULL REFERENCES productos(id),
  cantidad       INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal       NUMERIC(10,2) NOT NULL,
  notas          VARCHAR(255)
);

-- Comprobantes de pago
CREATE TABLE IF NOT EXISTS comprobantes (
  id                  SERIAL PRIMARY KEY,
  pedido_id           INTEGER NOT NULL UNIQUE REFERENCES pedidos(id),
  numero_comprobante  VARCHAR(30) NOT NULL UNIQUE,
  monto_total         NUMERIC(10,2) NOT NULL,
  metodo_pago         VARCHAR(20) NOT NULL
                        CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia')),
  monto_recibido      NUMERIC(10,2),
  cambio              NUMERIC(10,2) DEFAULT 0.00,
  whatsapp_enviado    BOOLEAN DEFAULT FALSE,
  whatsapp_enviado_en TIMESTAMP,
  creado_en           TIMESTAMP DEFAULT NOW()
);
