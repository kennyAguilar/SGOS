-- ─────────────────────────────────────────────────────────────────
--  SGOS Reportes – Setup inicial de base de datos (Neon.tech)
--  Ejecuta este script UNA SOLA VEZ en tu consola de Neon.tech
--  o con: psql "TU_DATABASE_URL" -f setup.sql
-- ─────────────────────────────────────────────────────────────────

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255)        NOT NULL,  -- bcrypt, factor 12
  role          VARCHAR(50)         NOT NULL DEFAULT 'operador',
  active        BOOLEAN             NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- Índice para búsquedas rápidas por username
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ─────────────────────────────────────────────────────────────────
--  USUARIO ADMINISTRADOR INICIAL
--
--  Contraseña de ejemplo: Sgos2026!
--  Hash generado con bcrypt(12). CAMBIA LA CONTRASEÑA DESPUÉS.
--
--  Para generar tu propio hash desde Node.js:
--    node -e "const b=require('bcryptjs'); b.hash('TuContraseña',12).then(console.log)"
-- ─────────────────────────────────────────────────────────────────
INSERT INTO users (username, password_hash, role)
VALUES (
  'admin',
  '$2a$12$K8pVaR7eNbEw4v/8Zb8XoONFmHAKvJ5r1j0m3.VKv7RJxrXVWGi3C',  -- Sgos2026!
  'administrador'
)
ON CONFLICT (username) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
--  Tabla de auditoría de intentos de login (opcional pero recomendado)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_audit (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(100) NOT NULL,
  ip_address  VARCHAR(45),
  success     BOOLEAN      NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_username ON login_audit (username, attempted_at DESC);
