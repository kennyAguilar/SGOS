"use strict";
/**
 * SGOS Reportes – app.js
 * Dashboard principal – verifica sesión y renderiza tabla de cuadratura
 */

/* ── Verificación de sesión ───────────────────────────────────── */
const token = sessionStorage.getItem("sgos_token");
if (!token) {
  window.location.replace("/login");
}

(async () => {
  try {
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("invalid");

    const { user } = await res.json();
    const chip = document.getElementById("userChip");
    if (chip) {
      chip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        ${user.username}`;
    }
  } catch {
    sessionStorage.clear();
    window.location.replace("/login");
  }
})();

/* ── Datos demo (se reemplazarán con carga Excel) ─────────────── */
const reportData = [
  { room:"Norte",  machine:"MX-104", date:"2026-05-06 08:00", srw:12450.75, sgos:12450.75 },
  { room:"Norte",  machine:"MX-118", date:"2026-05-06 08:00", srw:8320.50,  sgos:8301.35 },
  { room:"Centro", machine:"CX-021", date:"2026-05-06 08:30", srw:15220.00, sgos:15109.25 },
  { room:"Centro", machine:"CX-033", date:"2026-05-06 08:30", srw:9040.00,  sgos:9040.00 },
  { room:"Sur",    machine:"SX-072", date:"2026-05-06 09:00", srw:18675.80, sgos:18332.45 },
  { room:"Sur",    machine:"SX-088", date:"2026-05-06 09:00", srw:10560.40, sgos:10508.15 },
  { room:"Norte",  machine:"MX-121", date:"2026-05-06 09:15", srw:7210.25,  sgos:7210.25 },
  { room:"Centro", machine:"CX-045", date:"2026-05-06 09:30", srw:11350.90, sgos:11350.90 },
  { room:"Sur",    machine:"SX-091", date:"2026-05-06 09:45", srw:9995.20,  sgos:9811.05 },
];

const currency = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" });

/* ── Referencias DOM ──────────────────────────────────────────── */
const appShell    = document.querySelector(".app-layout");
const rowsTarget  = document.querySelector("#reportRows");
const roomFilter  = document.querySelector("#roomFilter");
const statusFilter= document.querySelector("#statusFilter");
const diffOnly    = document.querySelector("#diffOnly");
const tooltip     = document.querySelector("#tooltip");
const skeleton    = document.querySelector("#skeletonTable");
const gridWrap    = document.querySelector("#gridWrap");

/* ── Lógica QA ────────────────────────────────────────────────── */
function getStatus(row) {
  const diff    = row.srw - row.sgos;
  const percent = Math.abs(diff / row.srw) * 100;
  if (diff === 0)   return { key:"ok",    label:"Exacta",   className:"ok" };
  if (percent < 1)  return { key:"warn",  label:"Atencion", className:"warn" };
  return               { key:"error", label:"Critico",  className:"error" };
}

function getFiltered() {
  return reportData.filter((row) => {
    const s = getStatus(row);
    return (roomFilter.value   === "all" || row.room === roomFilter.value)
        && (statusFilter.value === "all" || s.key === statusFilter.value)
        && (!diffOnly.checked  || s.key !== "ok");
  });
}

/* ── Render tabla ─────────────────────────────────────────────── */
function renderRows() {
  const rows = getFiltered();
  if (!rows.length) {
    rowsTarget.innerHTML = `<tr><td colspan="7" class="empty-state">No hay cortes que coincidan con los filtros.</td></tr>`;
    return;
  }
  rowsTarget.innerHTML = rows.map((row) => {
    const s    = getStatus(row);
    const diff = row.srw - row.sgos;
    const pct  = Math.abs(diff / row.srw) * 100;
    const diffClass = s.key === "ok" ? "success-text" : s.key === "warn" ? "warn-text" : "error-text";
    const critClass  = s.key === "error" ? ` class="critical-row"` : "";
    return `
      <tr${critClass}>
        <td>${row.room}</td>
        <td class="mono">${row.machine}</td>
        <td class="mono">${row.date}</td>
        <td class="numeric mono" data-tooltip="SRW registrado para ${row.machine}">${currency.format(row.srw)}</td>
        <td class="numeric mono" data-tooltip="SGOS procesado para ${row.machine}">${currency.format(row.sgos)}</td>
        <td class="numeric mono ${diffClass}" data-tooltip="SRW: ${currency.format(row.srw)} | SGOS: ${currency.format(row.sgos)} | Variacion: ${pct.toFixed(2)}%">${currency.format(diff)}</td>
        <td><span class="pill ${s.className}"><i class="dot ${s.key === "ok" ? "success" : s.key === "warn" ? "warning" : "danger"}"></i>${s.label}</span></td>
      </tr>`;
  }).join("");
}

/* ── Skeleton loader ──────────────────────────────────────────── */
function showSkeleton() {
  skeleton.hidden = false;
  gridWrap.hidden = true;
  setTimeout(() => {
    skeleton.hidden = false;
    gridWrap.hidden = false;
    skeleton.hidden = true;
    renderRows();
  }, 800);
}

/* ── Exportar CSV ─────────────────────────────────────────────── */
function exportCsv() {
  const headers = ["Sala","Maquina","Fecha corte","SRW","SGOS","Diferencia","Estado QA"];
  const lines   = getFiltered().map((row) => {
    const s = getStatus(row);
    return [row.room, row.machine, row.date,
      row.srw.toFixed(2), row.sgos.toFixed(2),
      (row.srw - row.sgos).toFixed(2), s.label].join(",");
  });
  const csv  = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:"sgos-cuadratura.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Logout ───────────────────────────────────────────────────── */
document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.replace("/login");
});

/* ── Eventos ──────────────────────────────────────────────────── */
document.getElementById("toggleFilters").addEventListener("click", () => {
  appShell.dataset.navOpen = String(appShell.dataset.navOpen !== "true");
});

document.getElementById("loadDemo").addEventListener("click", showSkeleton);
document.getElementById("exportCsv").addEventListener("click", exportCsv);

[roomFilter, statusFilter, diffOnly].forEach((el) => el.addEventListener("change", renderRows));

/* ── Tooltips ─────────────────────────────────────────────────── */
document.addEventListener("mouseover", (e) => {
  const t = e.target.closest("[data-tooltip]");
  if (!t) return;
  tooltip.innerHTML = `<strong>Detalle</strong>${t.dataset.tooltip}`;
  tooltip.hidden    = false;
});

document.addEventListener("mousemove", (e) => {
  if (tooltip.hidden) return;
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top  = `${e.clientY + 14}px`;
});

document.addEventListener("mouseout", (e) => {
  if (e.target.closest("[data-tooltip]")) tooltip.hidden = true;
});

/* ── Inicio ───────────────────────────────────────────────────── */
renderRows();
