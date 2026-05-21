"""
SGOS Reportes – Creador de usuarios
Ejecutar con: .venv\Scripts\python.exe create_user.py

Crea un usuario en Neon.tech con la contraseña hasheada (PBKDF2-HMAC-SHA256).
"""

import getpass
import hashlib
import os
import secrets
import ssl
import sys
from urllib.parse import parse_qs, urlparse

import pg8000.dbapi
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("[ERROR] No se encontró DATABASE_URL en .env")
    sys.exit(1)

_PBKDF2_ITERS = 600_000

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERS)
    return f"pbkdf2:sha256:{_PBKDF2_ITERS}:{salt}:{dk.hex()}"

def _parse_db_url(url: str) -> dict:
    p  = urlparse(url)
    qs = parse_qs(p.query)
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

print("─" * 50)
print("  SGOS Reportes – Creación de usuario")
print("─" * 50)

username = input("Nombre de usuario : ").strip().lower()
if not username:
    print("[ERROR] El nombre de usuario no puede estar vacío.")
    sys.exit(1)

is_admin_input = input("¿Es administrador? (s/n) [n]: ").strip().lower() or "n"
is_admin = is_admin_input in ("s", "si", "sí", "y", "yes")

password = getpass.getpass("Contraseña (mín. 8 caracteres)  : ")
confirm  = getpass.getpass("Confirmar contraseña            : ")

if password != confirm:
    print("[ERROR] Las contraseñas no coinciden.")
    sys.exit(1)

if len(password) < 8:
    print("[ERROR] La contraseña debe tener al menos 8 caracteres.")
    sys.exit(1)

hashed = hash_password(password)

try:
    conn = pg8000.dbapi.connect(**_parse_db_url(DATABASE_URL))
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, %s)",
        (username, hashed, is_admin),
    )
    conn.commit()
    cur.close()
    conn.close()
    admin_label = "administrador" if is_admin else "usuario normal"
    print(f"\n[OK] Usuario '{username}' creado como {admin_label}.")
except Exception as exc:
    msg = str(exc)
    if "unique" in msg.lower() or "duplicate" in msg.lower():
        print(f"\n[ERROR] El usuario '{username}' ya existe.")
    else:
        print(f"\n[ERROR] {exc}")
    sys.exit(1)
