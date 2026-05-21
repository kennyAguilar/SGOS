"use strict";

/**
 * SGOS Reportes – Lógica de la página de login
 * Llama al backend (server.js) en POST /api/login
 * Guarda el JWT en sessionStorage (se borra al cerrar el navegador)
 */

// Cambia esta URL si tu backend corre en otro puerto o dominio
const API_BASE = "http://localhost:3001";

/* ── Referencias al DOM ─────────────────────────────────────────── */
const form         = document.getElementById("loginForm");
const usernameInput= document.getElementById("username");
const passwordInput= document.getElementById("password");
const submitBtn    = document.getElementById("submitBtn");
const btnText      = document.getElementById("btnText");
const btnSpinner   = document.getElementById("btnSpinner");
const errorBanner  = document.getElementById("errorBanner");
const errorText    = document.getElementById("errorText");
const togglePass   = document.getElementById("togglePassword");
const eyeIcon      = document.getElementById("eyeIcon");

/* ── Mostrar / ocultar contraseña ───────────────────────────────── */
togglePass.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePass.title   = isHidden ? "Ocultar contraseña" : "Mostrar contraseña";

  // Intercambiar ícono ojo abierto / cerrado
  eyeIcon.innerHTML = isHidden
    ? // ojo tachado
      `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : // ojo normal
      `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
});

/* ── Mostrar / ocultar banner de error ──────────────────────────── */
function showError(message) {
  errorText.textContent = message;
  errorBanner.hidden    = false;
  usernameInput.setAttribute("aria-invalid", "true");
  passwordInput.setAttribute("aria-invalid", "true");
}

function hideError() {
  errorBanner.hidden = true;
  usernameInput.removeAttribute("aria-invalid");
  passwordInput.removeAttribute("aria-invalid");
}

/* ── Estado del botón ───────────────────────────────────────────── */
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden     = loading;
  btnSpinner.hidden  = !loading;
}

/* ── Envío del formulario ───────────────────────────────────────── */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError("Por favor ingresa tu usuario y contraseña.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // El backend devuelve { error: "mensaje" }
      showError(data.error || "Error al iniciar sesión. Intente nuevamente.");
      return;
    }

    // ── Login exitoso: guardar token en sessionStorage ─────────
    // sessionStorage se borra automáticamente al cerrar el navegador.
    // NUNCA guardes el token en localStorage para este tipo de sistema.
    sessionStorage.setItem("sgos_token", data.token);
    sessionStorage.setItem("sgos_user",  JSON.stringify(data.user));

    // Redirigir al dashboard principal
    window.location.href = "index.html";

  } catch (err) {
    // Error de red (backend no disponible)
    console.error("[SGOS] Error de conexión:", err);
    showError("No se puede conectar al servidor. Verifique su conexión.");
  } finally {
    setLoading(false);
  }
});

/* ── Limpiar errores al empezar a escribir ──────────────────────── */
[usernameInput, passwordInput].forEach((input) => {
  input.addEventListener("input", hideError);
});

/* ── Redirigir si ya tiene sesión activa ────────────────────────── */
if (sessionStorage.getItem("sgos_token")) {
  window.location.href = "index.html";
}
