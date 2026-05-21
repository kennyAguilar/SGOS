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

import jwt
import pg8000.dbapi
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, url_for

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


# ── Inicio ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.logger.info("SGOS Reportes corriendo en http://localhost:%s", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=debug)
