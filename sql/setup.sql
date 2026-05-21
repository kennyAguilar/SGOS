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

-- Tabla de transacciones Getnet
CREATE TABLE IF NOT EXISTS getnet_transacciones (
    id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    jornada        DATE         NOT NULL,
    fecha          TIMESTAMP    NOT NULL,
    id_cliente     TEXT         NOT NULL,
    monto          NUMERIC(12,0) NOT NULL,
    voucher        TEXT         NOT NULL,
    slot_attendant TEXT,
    validador      TEXT,
    forma_pago     TEXT,
    ingreso_cawa   TEXT,
    operacion_uid  TEXT         NOT NULL UNIQUE,
    archivo_origen TEXT,
    created_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_getnet_jornada ON getnet_transacciones (jornada DESC);

-- Tabla de log de cargas de archivos
CREATE TABLE IF NOT EXISTS upload_log (
  id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          VARCHAR(50)  NOT NULL,
  archivo       TEXT         NOT NULL,
  usuario       VARCHAR(100) NOT NULL,
  rows_total    INT,
  rows_inserted INT,
  rows_skipped  INT,
  uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded ON upload_log (uploaded_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- Para crear el primer usuario administrador ejecuta:
--   python create_user.py
-- ──────────────────────────────────────────────────────────────────
