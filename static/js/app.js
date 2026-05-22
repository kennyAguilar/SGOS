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

/* ── Chart.js: tema oscuro global ─────────────────────────── */
if (typeof Chart !== "undefined") {
  Chart.defaults.color       = "#c6c6c6";
  Chart.defaults.borderColor = "#393939";
  Chart.defaults.font.family = "IBM Plex Sans, sans-serif";
  Chart.defaults.font.size   = 11;
}

const JORNADA_HOURS = [10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5,6,7,8];
const DOW_NAMES     = { 0:"Domingo", 1:"Lunes", 2:"Martes", 3:"Miércoles", 4:"Jueves", 5:"Viernes", 6:"Sábado" };
const DOW_ORDER     = [1,2,3,4,5,6,0];
let gnCharts        = {};

/* Reemplaza el canvas con uno nuevo para evitar "Canvas already in use" de Chart.js */
function freshCanvas(id) {
  const old    = document.getElementById(id);
  const canvas = document.createElement("canvas");
  canvas.id    = id;
  old.replaceWith(canvas);
  return canvas;
}

function gnScales(opts = {}) {
  return {
    x: { ticks: { color:"#c6c6c6", maxRotation:45, minRotation:30 }, grid: { color:"#393939" } },
    y: {
      ticks: { color:"#c6c6c6",
        callback: opts.money ? v => "$" + new Intl.NumberFormat("es-CL").format(v) : undefined },
      grid: { color:"#393939" },
    },
  };
}

async function loadGetnetDashboard() {
  const year  = yearFilter  ? yearFilter.value  : "";
  const month = monthFilter ? monthFilter.value : "";
  const params = new URLSearchParams();
  if (year)  params.set("year",  year);
  if (month) params.set("month", month);
  const url = `/api/getnet/dashboard${params.toString() ? "?" + params : ""}`;
  const lbl = document.getElementById("gnYearLabel");
  if (lbl) {
    const monthName = month && monthFilter
      ? monthFilter.options[monthFilter.selectedIndex].text
      : "";
    lbl.textContent = [year || "Todos", monthName].filter(Boolean).join(" · ");
  }
  try {
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) return;
    renderGetnetDashboard(data);
  } catch (err) { console.error("loadGetnetDashboard:", err); }
}

function renderGetnetDashboard({ por_mes, por_hora, heatmap, meta }) {
  Object.values(gnCharts).forEach(c => c.destroy());
  gnCharts = {};

  const gold = "#d4af37", teal = "#4fd1c5", blue = "#6699ff";
  const baseOpts = { responsive:true, maintainAspectRatio:false,
                     plugins:{ legend:{ labels:{ color:"#c6c6c6" } } } };

  gnCharts.opsMes = new Chart(freshCanvas("chartOpsMes"), {
    type: "bar",
    data: { labels: por_mes.map(r => r.mes_label),
            datasets: [{ label:"Operaciones", data: por_mes.map(r => r.ops),
                         backgroundColor: gold+"99", borderColor: gold, borderWidth:1 }] },
    options: { ...baseOpts, scales: gnScales() },
  });

  gnCharts.montosMes = new Chart(freshCanvas("chartMontosMes"), {
    type: "line",
    data: { labels: por_mes.map(r => r.mes_label),
            datasets: [{ label:"Monto Total", data: por_mes.map(r => r.monto),
                         borderColor:teal, backgroundColor:teal+"33",
                         tension:0.3, fill:true, pointBackgroundColor:teal, pointRadius:4 }] },
    options: { ...baseOpts, scales: gnScales({ money:true }) },
  });

  const horaMap   = new Map(por_hora.map(r => [r.hora, r]));
  const horasSort = JORNADA_HOURS.filter(h => horaMap.has(h));

  gnCharts.opsHora = new Chart(freshCanvas("chartOpsHora"), {
    type: "bar",
    data: { labels: horasSort,
            datasets: [{ label:"Promedio Operaciones", data: horasSort.map(h => horaMap.get(h).prom_ops),
                         backgroundColor: blue+"99", borderColor: blue, borderWidth:1 }] },
    options: { ...baseOpts, scales: gnScales() },
  });

  gnCharts.montosHora = new Chart(freshCanvas("chartMontosHora"), {
    type: "line",
    data: { labels: horasSort,
            datasets: [{ label:"Promedio Monto ($)", data: horasSort.map(h => horaMap.get(h).prom_monto),
                         borderColor:gold, backgroundColor:gold+"33",
                         tension:0.3, fill:true, pointBackgroundColor:gold, pointRadius:4 }] },
    options: { ...baseOpts, scales: gnScales({ money:true }) },
  });

  renderHeatmap(heatmap, meta);
}

function renderHeatmap(rows, meta) {
  const metaEl = document.getElementById("gnHeatmapMeta");
  const wrapEl = document.getElementById("gnHeatmap");
  if (!metaEl || !wrapEl) return;

  if (meta) {
    metaEl.innerHTML =
      `<span>Rango: <strong>${meta.fecha_min} → ${meta.fecha_max}</strong></span>` +
      `<span>Jornadas: <strong>${meta.total_jornadas}</strong></span>` +
      `<span>Lun: <strong>${meta.lun}</strong></span><span>Mar: <strong>${meta.mar}</strong></span>` +
      `<span>Mié: <strong>${meta.mie}</strong></span><span>Jue: <strong>${meta.jue}</strong></span>` +
      `<span>Vie: <strong>${meta.vie}</strong></span><span>Sáb: <strong>${meta.sab}</strong></span>` +
      `<span>Dom: <strong>${meta.dom}</strong></span>`;
  }

  const heat = {};
  DOW_ORDER.forEach(d => { heat[d] = {}; });
  rows.forEach(r => { if (!heat[r.dow]) heat[r.dow] = {}; heat[r.dow][r.hora] = r.prom; });

  const maxVal   = rows.length ? Math.max(...rows.map(r => r.prom)) : 1;
  const horasAct = JORNADA_HOURS.filter(h => rows.some(r => r.hora === h));

  let html = `<table class="gn-heatmap"><thead><tr><th></th>`;
  horasAct.forEach(h => { html += `<th class="hora-th">${h}</th>`; });
  html += `</tr></thead><tbody>`;

  DOW_ORDER.forEach(dow => {
    html += `<tr><th>${DOW_NAMES[dow]}</th>`;
    horasAct.forEach(h => {
      const v = heat[dow]?.[h];
      if (v === undefined) {
        html += `<td style="opacity:.25">—</td>`;
      } else {
        const a      = (0.1 + (v / maxVal) * 0.85).toFixed(2);
        const bright = v / maxVal > 0.6;
        html += `<td style="background:rgba(212,175,55,${a});color:${bright ? "#000" : "var(--cds-text-primary)"}">${v.toFixed(1)}</td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  wrapEl.innerHTML = html;
}

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
  else if (tabId === 'getnet') activateGnView(gnActiveView);
}

tabBtns.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

/* ── Getnet sub-vistas ────────────────────────────────────────── */
let gnActiveView = 'historico';
let gnAttLoaded  = false;
let gnHistData   = {};

// sort state per table: tblId → {col, dir}
const gnSorts = {
  tblMes:    { col:'mes',        dir:1  },
  tblHora:   { col:'hora',       dir:1  },
  tblRecord: { col:'operaciones',dir:-1 },
  tblAttMes: { col:'attendant',  dir:1  },
  tblConteo: { col:'operaciones',dir:-1 },
  tblAnual:  { col:'attendant',  dir:1  },
};

function activateGnView(view) {
  gnActiveView = view;
  document.querySelectorAll('.gn-subnav__btn').forEach(b =>
    b.classList.toggle('active', b.dataset.gnview === view)
  );
  const vHist = document.getElementById('gnViewHistorico');
  const vDash = document.getElementById('gnViewDashboard');
  if (vHist) vHist.hidden = (view !== 'historico');
  if (vDash) vDash.hidden = (view !== 'dashboard');
  if (view === 'historico') loadGnHistorico();
  else                      loadGetnetDashboard();
}

function _gnCheckedAttendants() {
  return [...document.querySelectorAll('.gnh-att-check:checked')].map(c => c.value);
}

async function loadGnHistorico() {
  const yr  = yearFilter  ? yearFilter.value  : '';
  const mo  = monthFilter ? monthFilter.value : '';
  const att = gnAttLoaded ? _gnCheckedAttendants().join(',') : '';
  const p   = new URLSearchParams();
  if (yr)  p.set('year',  yr);
  if (mo)  p.set('month', mo);
  if (att) p.set('attendants', att);

  // Mostrar loading en todos los cuerpos
  ['bodyMes','bodyHora','bodyRecord','bodyAttMes','bodyConteo','bodyAnual'].forEach(id => {
    const el = document.getElementById(id);
    const cols = (id === 'bodyAttMes' || id === 'bodyAnual') ? 4 : 3;
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty">Consultando…</td></tr>`;
  });

  try {
    const res  = await fetch(`/api/getnet/historico?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      ['bodyMes','bodyHora','bodyRecord','bodyAttMes','bodyConteo','bodyAnual'].forEach(id => {
        const el = document.getElementById(id);
        const cols = (id === 'bodyAttMes' || id === 'bodyAnual') ? 4 : 3;
        if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">${data.error}</td></tr>`;
      });
      return;
    }

    // Checkboxes (primera vez o tras cambio de año/mes)
    if (!gnAttLoaded) {
      const checks = document.getElementById('gnAttChecks');
      if (checks) _renderGnAttChecks(data.attendants, checks);
      gnAttLoaded = true;
    }

    gnHistData = data;
    _renderAllGnTables();
  } catch {
    ['bodyMes','bodyHora','bodyRecord','bodyAttMes','bodyConteo','bodyAnual'].forEach(id => {
      const el = document.getElementById(id);
      const cols = (id === 'bodyAttMes' || id === 'bodyAnual') ? 4 : 3;
      if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">Error de conexión.</td></tr>`;
    });
  }
}

function _renderGnAttChecks(attendants, container) {
  if (!attendants.length) { container.innerHTML = '<span class="gnh-att-empty">Sin datos de attendant</span>'; return; }
  container.innerHTML = attendants.map(a =>
    `<label class="gnh-att-item"><input type="checkbox" class="gnh-att-check" value="${a}" checked><span>${a}</span></label>`
  ).join('');
}

/* ── Render genérico de tabla sortable con totales ── */
function _renderGnTable(tblId, rows, colDefs, totChkId) {
  const body = document.getElementById('body' + tblId.replace('tbl',''));
  const foot = document.getElementById('foot' + tblId.replace('tbl',''));
  if (!body) return;
  const { col, dir } = gnSorts[tblId];
  const cols = colDefs.length;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty">Sin datos para los filtros seleccionados.</td></tr>`;
    if (foot) foot.hidden = true;
    return;
  }

  // Ordenar
  const sorted = [...rows].sort((a, b) => {
    const va = a[col], vb = b[col];
    if (col === 'mes' || col === 'attendant' || col === 'categoria') {
      const ka = col === 'mes' ? a.year * 100 + a.month : String(va);
      const kb = col === 'mes' ? b.year * 100 + b.month : String(vb);
      return ka < kb ? -dir : ka > kb ? dir : 0;
    }
    return ((va ?? 0) - (vb ?? 0)) * dir;
  });

  body.innerHTML = sorted.map(r => `<tr>${colDefs.map(cd =>
    `<td class="gnh-td${cd.numeric ? ' numeric' : ''}">${cd.fmt ? cd.fmt(r[cd.key], r) : r[cd.key]}</td>`
  ).join('')}</tr>`).join('');

  // Íconos sort
  document.querySelectorAll(`#${tblId} .gnh-th.sortable`).forEach(th => {
    const ic = th.querySelector('.sort-icon');
    if (!ic) return;
    ic.textContent = th.dataset.col === col ? (dir === 1 ? '↑' : '↓') : '↕';
    th.classList.toggle('sort-active', th.dataset.col === col);
  });

  // Totales
  if (!foot) return;
  const showTot = totChkId ? document.getElementById(totChkId)?.checked : false;
  foot.hidden = !showTot;
  if (showTot) {
    const numCols = colDefs.filter(cd => cd.numeric && cd.sumKey !== false);
    const cells = colDefs.map((cd, i) => {
      if (i === 0) return `<td class="gnh-td gnh-tot-label">Total (${rows.length})</td>`;
      if (!cd.numeric || cd.sumKey === false) return `<td class="gnh-td"></td>`;
      const s = rows.reduce((a, r) => a + (r[cd.key] || 0), 0);
      return `<td class="gnh-td numeric">${cd.fmt ? cd.fmt(s) : s.toLocaleString('es-CL')}</td>`;
    });
    foot.innerHTML = `<tr class="gnh-foot-row">${cells.join('')}</tr>`;
  }
}

function _renderAllGnTables() {
  const d = gnHistData;
  if (!d) return;

  // ① Resumen Mensual
  _renderGnTable('tblMes', d.rows_mes || [], [
    { key:'mes',        label:'Mes'         },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totMes');

  // ② Operaciones por Hora
  _renderGnTable('tblHora', d.rows_hora || [], [
    { key:'hora',       label:'Hora',        fmt: v => `${String(v).padStart(2,'0')}:00` },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totHora');

  // ③ Record Asistentes
  _renderGnTable('tblRecord', d.rows_record || [], [
    { key:'attendant',  label:'Asistente'   },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totRecord');

  // ④ Asistente por Mes
  _renderGnTable('tblAttMes', d.rows_att_mes || [], [
    { key:'attendant',  label:'Asistente'   },
    { key:'mes',        label:'Mes'         },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], null);

  // ⑤ Conteo Operaciones
  _renderGnTable('tblConteo', d.rows_conteo || [], [
    { key:'categoria',  label:'Forma de Pago' },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totConteo');

  // ⑥ Total anual por asistente
  _renderGnTable('tblAnual', d.rows_anual || [], [
    { key:'attendant',  label:'Asistente'   },
    { key:'year',       label:'Año',         numeric:true, fmt: v => String(v) },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totAnual');
}

/* ── Sort click (delegado en gnViewHistorico) ─────────────────── */
document.getElementById('gnViewHistorico')?.addEventListener('click', e => {
  const th = e.target.closest('.gnh-th.sortable');
  if (!th) return;
  const tbl = th.closest('table');
  if (!tbl) return;
  const tblId = tbl.id;
  if (!gnSorts[tblId]) return;
  const c = th.dataset.col;
  gnSorts[tblId].dir = (gnSorts[tblId].col === c) ? gnSorts[tblId].dir * -1 : 1;
  gnSorts[tblId].col = c;
  _renderAllGnTables();
});

/* ── Totales toggle (delegado) ────────────────────────────────── */
document.getElementById('gnViewHistorico')?.addEventListener('change', e => {
  if (e.target.classList.contains('gnh-tot-chk')) _renderAllGnTables();
});

/* ── Accordion toggle ─────────────────────────────────────────── */
document.getElementById('gnViewHistorico')?.addEventListener('click', e => {
  const btn = e.target.closest('.gnh-acc-header');
  if (!btn) return;
  const acc = btn.closest('.gnh-acc');
  if (!acc) return;
  acc.dataset.open = acc.dataset.open === 'true' ? 'false' : 'true';
});

/* ── Todos / Ninguno attendants ───────────────────────────────── */
document.getElementById('gnAttAll')?.addEventListener('click', () => {
  document.querySelectorAll('.gnh-att-check').forEach(c => c.checked = true);
  loadGnHistorico();
});
document.getElementById('gnAttNone')?.addEventListener('click', () => {
  document.querySelectorAll('.gnh-att-check').forEach(c => c.checked = false);
  loadGnHistorico();
});
document.getElementById('gnAttChecks')?.addEventListener('change', () => loadGnHistorico());

document.querySelectorAll('.gn-subnav__btn').forEach(b =>
  b.addEventListener('click', () => activateGnView(b.dataset.gnview))
);

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

    // Actualizar sidebar
    const metaCarga   = document.getElementById("metaCarga");
    const metaArchivo = document.getElementById("metaArchivo");
    if (metaCarga)   metaCarga.textContent   = data.ultima_carga   || "—";
    if (metaArchivo) metaArchivo.textContent = data.ultimo_archivo || "—";

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
  if (!rowsTarget) return;   /* guard: el elemento puede no existir en esta vista */
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
const applyFilter = document.getElementById("applyFilter");
[showTotals].forEach((el) => el.addEventListener("change", renderRows));
nameFilter.addEventListener("input", renderRows);
applyFilter.addEventListener("click", () => {
  const activeTab = document.querySelector(".header-tab.active")?.dataset.tab;
  if (activeTab === "getnet") {
    gnAttLoaded = false;   // recargar attendants al cambiar año/mes
    activateGnView(gnActiveView);
  } else {
    renderRows();
  }
});

/* Recargar dashboard Getnet al cambiar año (via botón Aplicar, no aquí) */

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
