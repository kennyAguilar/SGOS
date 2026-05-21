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
const yearFilter  = document.querySelector("#yearFilter");
const monthFilter = document.querySelector("#monthFilter");
const nameFilter  = document.querySelector("#nameFilter");
const showTotals  = document.querySelector("#showTotals");
const tooltip     = document.querySelector("#tooltip");
const skeleton    = document.querySelector("#skeletonTable");
const gridWrap    = document.querySelector("#gridWrap");

/* ── Tab switching ──────────────────────────────────── */
const tabBtns = document.querySelectorAll('.header-tab[data-tab]');

function activateTab(tabId) {
  tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.hidden = p.id !== `panel-${tabId}`;
  });
  if (tabId === 'resumen') loadResumenGetnet();
}

tabBtns.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

/* ── Resumen Getnet ───────────────────────────────── */
const resumenEl = document.getElementById('resumenGetnet');
const clpFmt    = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

async function loadResumenGetnet() {
  if (!resumenEl) return;
  resumenEl.innerHTML = '<p class="resumen-loading">Consultando base de datos…</p>';
  try {
    const res  = await fetch('/api/resumen/getnet', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok)    { resumenEl.innerHTML = `<p class="resumen-error">${data.error}</p>`; return; }
    if (data.empty) { resumenEl.innerHTML = '<p class="resumen-empty">Sin datos — carga el primer Excel Getnet.</p>'; return; }

    const jornada = new Date(data.ultima_jornada + 'T12:00:00')
      .toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

    resumenEl.innerHTML =
      '<article class="resumen-card">' +
        '<span class="rc-label">Mes cargado</span>' +
        `<strong class="rc-value">${data.ultimo_mes}</strong>` +
        `<small class="rc-sub">${data.ultima_carga}</small>` +
      '</article>' +
      '<article class="resumen-card">' +
        '<span class="rc-label">Hasta jornada</span>' +
        `<strong class="rc-value mono">${jornada}</strong>` +
        '<small class="rc-sub">Última jornada registrada</small>' +
      '</article>' +
      '<article class="resumen-card rc-highlight">' +
        '<span class="rc-label">Monto total del mes</span>' +
        `<strong class="rc-value mono">${clpFmt.format(data.monto_total)}</strong>` +
        `<small class="rc-sub">${data.total_operaciones.toLocaleString('es-CL')} operaciones</small>` +
      '</article>' +
      '<article class="resumen-card">' +
        '<span class="rc-label">Última jornada</span>' +
        `<strong class="rc-value mono">${clpFmt.format(data.monto_ultima_jornada)}</strong>` +
        `<small class="rc-sub">${data.ops_ultima_jornada.toLocaleString('es-CL')} ops · ${jornada}</small>` +
      '</article>';
  } catch {
    resumenEl.innerHTML = '<p class="resumen-error">Error de conexión al servidor.</p>';
  }
}

/* Cargar al inicio (tab Resumen activo por defecto) */
loadResumenGetnet();

/* ── Lógica QA ────────────────────────────────────────────────── */
function getStatus(row) {
  const diff    = row.srw - row.sgos;
  const percent = Math.abs(diff / row.srw) * 100;
  if (diff === 0)   return { key:"ok",    label:"Exacta",   className:"ok" };
  if (percent < 1)  return { key:"warn",  label:"Atencion", className:"warn" };
  return               { key:"error", label:"Critico",  className:"error" };
}

function getFiltered() {
  const yr   = yearFilter.value;
  const mo   = monthFilter.value;
  const name = nameFilter.value.trim().toLowerCase();
  return reportData.filter((row) => {
    const dateParts = row.date.split("-"); // ["2026","05","06 ..."
    if (yr   && dateParts[0] !== yr)                   return false;
    if (mo   && parseInt(dateParts[1], 10) !== parseInt(mo, 10)) return false;
    if (name && !(row.room + " " + row.machine).toLowerCase().includes(name)) return false;
    return true;
  });
}

/* ── Render tabla ─────────────────────────────────────────────── */
function renderRows() {
  const rows = getFiltered();
  if (!rows.length) {
    rowsTarget.innerHTML = `<tr><td colspan="7" class="empty-state">No hay cortes que coincidan con los filtros.</td></tr>`;
    const f = rowsTarget.closest("table").querySelector("tfoot");
    if (f) f.remove();
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

  // ── Fila de totales ──────────────────────────────────────
  const table    = rowsTarget.closest("table");
  const oldFoot  = table.querySelector("tfoot");
  if (oldFoot) oldFoot.remove();

  if (showTotals && showTotals.checked) {
    const sumSrw  = rows.reduce((a, r) => a + r.srw,  0);
    const sumSgos = rows.reduce((a, r) => a + r.sgos, 0);
    const sumDiff = sumSrw - sumSgos;
    const diffCls = sumDiff === 0 ? "success-text" : Math.abs(sumDiff / sumSrw) * 100 < 1 ? "warn-text" : "error-text";
    const tfoot   = document.createElement("tfoot");
    tfoot.innerHTML = `
      <tr class="totals-row">
        <td colspan="3">Total (${rows.length} registros)</td>
        <td class="numeric">${currency.format(sumSrw)}</td>
        <td class="numeric">${currency.format(sumSgos)}</td>
        <td class="numeric ${diffCls}">${currency.format(sumDiff)}</td>
        <td></td>
      </tr>`;
    table.appendChild(tfoot);
  }
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

/* ── Modal Cargar Excel ───────────────────────────────────────── */
const uploadModal   = document.getElementById("uploadModal");
const uploadTipo    = document.getElementById("uploadTipo");
const uploadFile    = document.getElementById("uploadFile");
const uploadResult  = document.getElementById("uploadResult");
const uploadConfirm = document.getElementById("uploadConfirm");

function openUploadModal() {
  uploadFile.value        = "";
  uploadResult.hidden     = true;
  uploadResult.className  = "upload-result";
  uploadModal.classList.add("is-visible");
}

function closeUploadModal() {
  uploadModal.classList.remove("is-visible");
}

function showUploadResult(msg, isError) {
  uploadResult.textContent = msg;
  uploadResult.className   = "upload-result" + (isError ? " error" : "");
  uploadResult.hidden      = false;
}

document.getElementById("uploadModalClose").addEventListener("click", closeUploadModal);
document.getElementById("uploadCancel").addEventListener("click", closeUploadModal);
uploadModal.addEventListener("click", (e) => { if (e.target === uploadModal) closeUploadModal(); });

uploadConfirm.addEventListener("click", async () => {
  const file = uploadFile.files[0];
  if (!file) { showUploadResult("Selecciona un archivo .xlsx primero.", true); return; }
  if (!file.name.toLowerCase().endsWith(".xlsx")) { showUploadResult("Solo se aceptan archivos .xlsx.", true); return; }

  uploadConfirm.disabled    = true;
  uploadConfirm.textContent = "Cargando…";

  const form = new FormData();
  form.append("file", file);

  try {
    const res  = await fetch(`/api/upload/${uploadTipo.value}`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    });
    const data = await res.json();
    if (!res.ok) {
      showUploadResult(data.error || "Error al procesar el archivo.", true);
    } else {
      showUploadResult(
        `✓  ${data.rows_inserted} filas insertadas\n` +
        `⊘  ${data.rows_skipped} omitidas (duplicadas)\n` +
        `Total procesadas: ${data.rows_total}`,
        false
      );
    }
  } catch {
    showUploadResult("Error de conexión al servidor.", true);
  } finally {
    uploadConfirm.disabled    = false;
    uploadConfirm.textContent = "Cargar";
  }
});

document.getElementById("loadDemo").addEventListener("click", openUploadModal);
document.getElementById("exportCsv").addEventListener("click", exportCsv);

/* Botones Todos / Ninguno */
document.getElementById("filtersAll").addEventListener("click", () => {
  yearFilter.value  = "2025";
  monthFilter.value = "";
  nameFilter.value  = "";
  renderRows();
});
document.getElementById("filtersNone").addEventListener("click", () => {
  nameFilter.value = "";
  renderRows();
});

/* Eventos de filtros */
[yearFilter, monthFilter, showTotals].forEach((el) => el.addEventListener("change", renderRows));
nameFilter.addEventListener("input", renderRows);

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
