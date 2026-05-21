-- ──────────────────────────────────────────────────────────────────
--  SGOS Reportes – Setup inicial de Neon.tech
--  Ejecutar UNA SOLA VEZ:
--    psql "TU_DATABASE_URL" -f sql/setup.sql
--  O pegar en el SQL Editor de Neon.tech
-- ──────────────────────────────────────────────────────────────────

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL       PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Tabla de auditoría de accesos
CREATE TABLE IF NOT EXISTS login_audit (
  id           SERIAL       PRIMARY KEY,
  username     VARCHAR(100) NOT NULL,
  ip_address   VARCHAR(45),
  success      BOOLEAN      NOT NULL,
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON login_audit (username, attempted_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- Para crear el primer usuario administrador ejecuta:
--   python create_user.py
-- ──────────────────────────────────────────────────────────────────
