"""
SGOS Reportes – Backend Flask
Conecta a Neon.tech (PostgreSQL), sirve el frontend y expone la API de autenticación.

Rutas de páginas:
  GET  /          → redirige a /login
  GET  /login     → login.html
  GET  /home      → index.html (dashboard)

API:
  POST /api/login  → { username, password } → { token, user }
  GET  /api/me     → valida JWT → { user }
  GET  /api/health → estado del servidor
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import ssl
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import parse_qs, urlparse

import pandas as pd
import jwt
import pg8000.dbapi
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, url_for
from io import BytesIO

load_dotenv()

# ── Validación temprana de variables de entorno ────────────────────
for _var in ("DATABASE_URL", "JWT_SECRET"):
    if not os.getenv(_var):
        raise RuntimeError(f"[SGOS] Variable de entorno requerida: {_var}")

DATABASE_URL     = os.environ["DATABASE_URL"]
JWT_SECRET       = os.environ["JWT_SECRET"]
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))
PORT             = int(os.getenv("PORT", "5000"))

# ── Flask ──────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Helpers de contraseña (PBKDF2-HMAC-SHA256, 600 000 iter) ───────
_PBKDF2_ITERS = 600_000
_DUMMY_HASH   = "pbkdf2:sha256:600000:" + "a" * 32 + ":" + "b" * 64

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERS)
    return f"pbkdf2:sha256:{_PBKDF2_ITERS}:{salt}:{dk.hex()}"

def check_password(password: str, stored: str) -> bool:
    try:
        _, alg, iters_s, salt, dk_hex = stored.split(":")
        dk_exp = bytes.fromhex(dk_hex)
        dk_act = hashlib.pbkdf2_hmac(alg, password.encode(), salt.encode(), int(iters_s))
        return hmac.compare_digest(dk_act, dk_exp)
    except Exception:
        return False


# ── Conexión a Neon.tech vía pg8000 ───────────────────────────────
def _parse_db_url(url: str) -> dict:
    p   = urlparse(url)
    qs  = parse_qs(p.query)
    ssl_mode = qs.get("sslmode", [""])[0]
    kwargs: dict = {
        "host":     p.hostname,
        "port":     p.port or 5432,
        "database": p.path.lstrip("/"),
        "user":     p.username,
        "password": p.password,
    }
    if ssl_mode in ("require", "verify-ca", "verify-full"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode    = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
    return kwargs

_DB_KWARGS = _parse_db_url(DATABASE_URL)

def _get_conn():
    return pg8000.dbapi.connect(**_DB_KWARGS)

def _put_conn(conn):
    try:
        conn.close()
    except Exception:
        pass


# ── Decorador de autenticación JWT ─────────────────────────────────
def require_auth(f):
    @wraps(f)
    def _wrap(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            app.logger.warning("require_auth: sin header Bearer. Auth recibida: %r", auth[:40])
            return jsonify({"error": "Token de autorización requerido."}), 401
        token_str = auth[7:].strip()
        try:
            request.current_user = jwt.decode(token_str, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            app.logger.warning("require_auth: token expirado")
            return jsonify({"error": "La sesión ha expirado."}), 401
        except Exception as e:
            app.logger.error("require_auth: decode falló — %s: %s", type(e).__name__, e)
            return jsonify({"error": "Token inválido."}), 401
        return f(*args, **kwargs)
    return _wrap


# ── Páginas ────────────────────────────────────────────────────────
@app.get("/")
def root():
    return redirect(url_for("login_page"))

@app.get("/login")
def login_page():
    return render_template("login.html")

@app.get("/home")
def home_page():
    return render_template("index.html")


# ── API: autenticación ─────────────────────────────────────────────
@app.post("/api/login")
def api_login():
    data     = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña son requeridos."}), 400

    # Prevenir ataques de payload gigante
    if len(username) > 100 or len(password) > 128:
        return jsonify({"error": "Credenciales con formato inválido."}), 400

    conn = None
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, username, password_hash, is_admin FROM users WHERE username = %s LIMIT 1",
            (username,),
        )
        row = cur.fetchone()
        cur.close()
    except Exception as exc:
        app.logger.error("DB error: %s", exc)
        return jsonify({"error": "Error interno del servidor."}), 500
    finally:
        if conn:
            _put_conn(conn)

    # Siempre ejecutar PBKDF2 (previene timing attacks cuando el usuario no existe)
    stored = row[2] if row else _DUMMY_HASH
    ok = check_password(password, stored)

    # Registrar intento en audit log
    try:
        conn_a = _get_conn()
        cur_a  = conn_a.cursor()
        cur_a.execute(
            "INSERT INTO login_audit (username, ip_address, success) VALUES (%s, %s, %s)",
            (username, request.remote_addr, bool(row and ok)),
        )
        conn_a.commit()
        cur_a.close()
    except Exception as exc:
        app.logger.warning("login_audit insert falló: %s", exc)
    finally:
        _put_conn(conn_a)

    if not row or not ok:
        return jsonify({"error": "Usuario o contraseña incorrectos."}), 401

    # Actualizar last_login_at
    try:
        conn2 = _get_conn()
        cur2  = conn2.cursor()
        cur2.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (row[0],))
        conn2.commit()
        cur2.close()
    except Exception:
        pass
    finally:
        _put_conn(conn2)

    payload = {
        "sub":      str(row[0]),
        "username": row[1],
        "is_admin": bool(row[3]),
        "exp":      datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return jsonify({
        "token": token,
        "user":  {"id": row[0], "username": row[1], "is_admin": bool(row[3])},
    })


@app.get("/api/me")
@require_auth
def api_me():
    return jsonify({"user": request.current_user})

@app.get("/api/health")
def api_health():
    return jsonify({"status": "ok", "ts": datetime.now(timezone.utc).isoformat()})


@app.get("/api/resumen/getnet")
@require_auth
def api_resumen_getnet():
    sql = """
    WITH ultima AS (
        SELECT MAX(jornada) AS jornada FROM getnet_transacciones
    )
    SELECT
        u.jornada::text                                                              AS ultima_jornada,
        TO_CHAR(u.jornada, 'FMMonth YYYY')                                          AS ultimo_mes,
        (SELECT COUNT(*)::int       FROM getnet_transacciones)                      AS total_operaciones,
        (SELECT SUM(monto)::bigint  FROM getnet_transacciones)                      AS monto_total,
        (SELECT SUM(g.monto)::bigint FROM getnet_transacciones g
          WHERE g.jornada = u.jornada)                                              AS monto_ultima_jornada,
        (SELECT COUNT(*)::int       FROM getnet_transacciones g
          WHERE g.jornada = u.jornada)                                              AS ops_ultima_jornada,
        (SELECT archivo_origen FROM getnet_transacciones
          ORDER BY created_at DESC LIMIT 1)                                         AS ultimo_archivo,
        TO_CHAR((SELECT MAX(created_at) FROM getnet_transacciones),
                'DD/MM/YYYY HH24:MI')                                               AS ultima_carga
    FROM ultima u
    """
    conn = None
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(sql)
        row  = cur.fetchone()
        cur.close()
    except Exception as exc:
        app.logger.error("resumen/getnet error: %s", exc)
        return jsonify({"error": "Error consultando base de datos."}), 500
    finally:
        if conn:
            _put_conn(conn)

    if not row or row[0] is None:
        return jsonify({"empty": True})

    return jsonify({
        "ultima_jornada":       row[0],
        "ultimo_mes":           row[1],
        "total_operaciones":    row[2],
        "monto_total":          int(row[3]) if row[3] else 0,
        "monto_ultima_jornada": int(row[4]) if row[4] else 0,
        "ops_ultima_jornada":   row[5],
        "ultimo_archivo":       row[6],
        "ultima_carga":         row[7],
    })


# ── Upload Excel ───────────────────────────────────────────────────
_UPLOAD_TIPOS    = {"getnet", "premios", "comps", "coinin_mda", "coinin_mdj", "jefatura"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

_GETNET_REQUIRED_COLS = {
    "Jornada", "Fecha", "Id Cliente", "Monto", "Voucher",
    "Slot Attendant", "Validador", "Forma Pago", "Ingreso CAWA",
}


def _crear_operacion_uid(row) -> str:
    fecha      = pd.to_datetime(row["Fecha"], dayfirst=True).strftime("%Y%m%d%H%M")
    id_cliente = str(row["Id Cliente"]).replace("'", "").strip()
    ultimos_12 = id_cliente[-12:]
    monto      = int(float(row["Monto"]))
    voucher    = str(row["Voucher"]).replace("'", "").strip().zfill(6)
    return f"{fecha}-{ultimos_12}-{monto}-{voucher}"


def _process_getnet(df: pd.DataFrame, filename: str) -> dict:
    missing = _GETNET_REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Columnas faltantes en el Excel: {sorted(missing)}")

    df = df.copy()
    df["operacion_uid"]  = df.apply(_crear_operacion_uid, axis=1)
    df["jornada"]        = pd.to_datetime(df["Jornada"]).dt.date
    df["fecha"]          = pd.to_datetime(df["Fecha"], dayfirst=True)
    df["id_cliente"]     = df["Id Cliente"].astype(str).str.replace("'", "", regex=False).str.strip()
    df["monto"]          = df["Monto"].astype(float).astype(int)
    df["voucher"]        = df["Voucher"].astype(str).str.replace("'", "", regex=False).str.strip().str.zfill(6)
    df["slot_attendant"] = df["Slot Attendant"].astype(str).str.strip()
    df["validador"]      = df["Validador"].astype(str).str.strip()
    df["forma_pago"]     = df["Forma Pago"].astype(str).str.strip()
    df["ingreso_cawa"]   = df["Ingreso CAWA"].astype(str).str.strip()

    sql = """
    INSERT INTO getnet_transacciones
        (jornada, fecha, id_cliente, monto, voucher,
         slot_attendant, validador, forma_pago, ingreso_cawa,
         operacion_uid, archivo_origen)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT (operacion_uid) DO NOTHING
    """
    registros = [
        (
            row["jornada"],
            row["fecha"].to_pydatetime(),
            row["id_cliente"],
            int(row["monto"]),
            row["voucher"],
            row["slot_attendant"],
            row["validador"],
            row["forma_pago"],
            row["ingreso_cawa"],
            row["operacion_uid"],
            filename,
        )
        for _, row in df.iterrows()
    ]

    inserted = 0
    conn = _get_conn()
    try:
        cur = conn.cursor()
        for record in registros:
            cur.execute(sql, record)
            inserted += cur.rowcount
        conn.commit()
        cur.close()
    finally:
        _put_conn(conn)

    return {
        "rows_total":    len(registros),
        "rows_inserted": inserted,
        "rows_skipped":  len(registros) - inserted,
    }


_PROCESSORS = {
    "getnet": _process_getnet,
}


@app.post("/api/upload/<tipo>")
@require_auth
def api_upload(tipo: str):
    if tipo not in _UPLOAD_TIPOS:
        return jsonify({"error": f"Tipo de archivo no válido: {tipo}"}), 400

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No se recibió ningún archivo."}), 400

    filename = file.filename
    if not filename.lower().endswith(".xlsx"):
        return jsonify({"error": "Solo se aceptan archivos .xlsx."}), 400

    raw = file.read(_MAX_UPLOAD_BYTES + 1)
    if len(raw) > _MAX_UPLOAD_BYTES:
        return jsonify({"error": "El archivo supera el límite de 10 MB."}), 413

    if tipo not in _PROCESSORS:
        return jsonify({"error": f"Procesador para '{tipo}' aún no implementado."}), 501

    try:
        df = pd.read_excel(
            BytesIO(raw),
            sheet_name="Sheet1",
            header=1,
            dtype={"Id Cliente": str, "Voucher": str},
        )
    except Exception as exc:
        app.logger.error("Error leyendo Excel '%s': %s", filename, exc)
        return jsonify({"error": "No se pudo leer el archivo Excel. Verifica el formato."}), 422

    try:
        result = _PROCESSORS[tipo](df, filename)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        app.logger.error("Error procesando '%s' tipo '%s': %s", filename, tipo, exc)
        return jsonify({"error": "Error interno al procesar el archivo."}), 500

    # Registrar carga en upload_log
    try:
        conn_l = _get_conn()
        cur_l  = conn_l.cursor()
        cur_l.execute(
            """INSERT INTO upload_log
                   (tipo, archivo, usuario, rows_total, rows_inserted, rows_skipped)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                tipo,
                filename,
                request.current_user.get("username", "?"),
                result["rows_total"],
                result["rows_inserted"],
                result["rows_skipped"],
            ),
        )
        conn_l.commit()
        cur_l.close()
    except Exception as exc:
        app.logger.warning("upload_log insert falló: %s", exc)
    finally:
        _put_conn(conn_l)

    return jsonify({**result, "archivo": filename})


# ── Inicio ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.logger.info("SGOS Reportes corriendo en http://localhost:%s", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=debug)
