/**
 * SGOS Reportes – Backend de autenticación
 * Se conecta a Neon.tech (PostgreSQL) y expone:
 *   POST /api/login   → verifica usuario + contraseña, devuelve JWT
 *   GET  /api/me      → valida token y devuelve datos del usuario
 *   POST /api/logout  → (stateless, el cliente descarta el token)
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { Pool } = require("pg");
require("dotenv").config();

/* ── Validación temprana de variables de entorno ──────────────────── */
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];
REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[SGOS] Variable de entorno requerida no definida: ${key}`);
    process.exit(1);
  }
});

const PORT       = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "8h"; // sesión de turno laboral

/* ── Pool de conexión a Neon.tech (PostgreSQL con SSL) ────────────── */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }, // SSL obligatorio con Neon
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[SGOS] Error inesperado en pool de conexión:", err.message);
});

/* ── App Express ──────────────────────────────────────────────────── */
const app = express();

// CORS: solo permite el origen donde sirves el frontend
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500").split(",");

app.use(cors({
  origin: (origin, callback) => {
    // Permitir llamadas sin origen (ej. herramientas de prueba en local)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "16kb" })); // limita tamaño de body

/* ── Middleware: verificar JWT ────────────────────────────────────── */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autorización requerido." });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

/* ── Rutas ────────────────────────────────────────────────────────── */

/** POST /api/login
 *  Body: { username: string, password: string }
 *  Responde: { token: string, user: { id, username, role } }
 */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Validación básica de entrada
  if (
    typeof username !== "string" || username.trim().length === 0 ||
    typeof password !== "string" || password.length === 0
  ) {
    return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
  }

  // Límite de longitud para evitar ataques de hash-bombing
  if (username.length > 100 || password.length > 128) {
    return res.status(400).json({ error: "Credenciales con formato inválido." });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, role FROM users WHERE username = $1 LIMIT 1",
      [username.trim().toLowerCase()]
    );

    const user = result.rows[0];

    // Siempre comparar hash aunque el usuario no exista (previene timing attacks)
    const dummyHash = "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const hashToCompare = user ? user.password_hash : dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("[SGOS /api/login] Error:", err.message);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

/** GET /api/me
 *  Header: Authorization: Bearer <token>
 *  Responde: { user: { id, username, role } }
 */
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** Health check */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* ── Inicio ───────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`[SGOS] Backend corriendo en http://localhost:${PORT}`);
  console.log(`[SGOS] Conectado a Neon.tech (${process.env.DATABASE_URL.split("@")[1]?.split("/")[0] ?? "host oculto"})`);
});
