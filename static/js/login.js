"use strict";
/**
 * SGOS Reportes – login.js
 * POST /api/login → JWT guardado en sessionStorage → redirige a /home
 */

const form         = document.getElementById("loginForm");
const usernameInput= document.getElementById("username");
const passwordInput= document.getElementById("password");
const submitBtn    = document.getElementById("submitBtn");
const btnContent   = document.getElementById("btnContent");
const btnSpinner   = document.getElementById("btnSpinner");
const errorBanner  = document.getElementById("errorBanner");
const errorText    = document.getElementById("errorText");
const togglePass   = document.getElementById("togglePass");
const eyeIcon      = document.getElementById("eyeIcon");

/* ── Mostrar / ocultar contraseña ─────────────────────────────── */
togglePass.addEventListener("click", () => {
  const hidden = passwordInput.type === "password";
  passwordInput.type = hidden ? "text" : "password";
  eyeIcon.innerHTML  = hidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

/* ── Error banner ─────────────────────────────────────────────── */
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.hidden    = false;
  usernameInput.setAttribute("aria-invalid", "true");
  passwordInput.setAttribute("aria-invalid", "true");
}

function hideError() {
  errorBanner.hidden = true;
  usernameInput.removeAttribute("aria-invalid");
  passwordInput.removeAttribute("aria-invalid");
}

/* ── Estado de carga ──────────────────────────────────────────── */
function setLoading(on) {
  submitBtn.disabled = on;
  btnContent.hidden  = on;
  btnSpinner.hidden  = !on;
}

/* ── Submit ───────────────────────────────────────────────────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError("Por favor ingresa tu usuario y contraseña.");
    return;
  }

  setLoading(true);

  try {
    const res  = await fetch("/api/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Error al iniciar sesión.");
      return;
    }

    // Guardar en sessionStorage (se borra al cerrar el navegador)
    sessionStorage.setItem("sgos_token", data.token);
    sessionStorage.setItem("sgos_user",  JSON.stringify(data.user));

    window.location.href = "/home";

  } catch {
    showError("No se puede conectar al servidor. Verifica tu red.");
  } finally {
    setLoading(false);
  }
});

/* ── Limpiar error al escribir ────────────────────────────────── */
[usernameInput, passwordInput].forEach((el) => el.addEventListener("input", hideError));

/* ── Redirigir si ya hay sesión activa ────────────────────────── */
if (sessionStorage.getItem("sgos_token")) {
  window.location.href = "/home";
}
