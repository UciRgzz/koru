-- Ejecutar en pgAdmin sobre restaurante_db

CREATE TABLE IF NOT EXISTS usuarios (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  email     VARCHAR(150) NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,
  rol       VARCHAR(20) DEFAULT 'admin' CHECK (rol IN ('admin', 'cocina')),
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Contraseña por defecto: admin123
INSERT INTO usuarios (nombre, email, password, rol) VALUES
('Administrador', 'admin@negocio.com',  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Cocina',        'cocina@negocio.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cocina');
