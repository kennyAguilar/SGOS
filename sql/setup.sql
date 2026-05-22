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

-- Tabla de transacciones Premios
CREATE TABLE IF NOT EXISTS premios_transacciones (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha               TIMESTAMP     NOT NULL,
    jornada             DATE          NOT NULL,
    cliente             TEXT          NOT NULL,
    transferencia_final NUMERIC(12,0) NOT NULL,
    slot_attendant      TEXT,
    tipo_pago           TEXT,
    operacion_uid       TEXT          NOT NULL UNIQUE,
    archivo_origen      TEXT,
    created_at          TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premios_jornada ON premios_transacciones (jornada DESC);

-- Tabla de Comps (Voucher Complementary)
CREATE TABLE IF NOT EXISTS comps_transacciones (
    id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comps_uid       TEXT         NOT NULL UNIQUE,
    consumo_id      TEXT         NOT NULL,
    fecha_jornada   DATE         NOT NULL,
    cliente_id      TEXT,
    nombre_cliente  TEXT,
    descripcion_cat TEXT,
    descripcion_prod TEXT,
    micros          NUMERIC(12,0),
    estado          TEXT,
    usuario_id      TEXT,
    nombre_usuario  TEXT,
    archivo_origen  TEXT,
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comps_jornada ON comps_transacciones (fecha_jornada DESC);

-- ──────────────────────────────────────────────────────────────────
-- Para crear el primer usuario administrador ejecuta:
--   python create_user.py
-- ──────────────────────────────────────────────────────────────────
