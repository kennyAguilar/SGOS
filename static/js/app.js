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
  if (tabId === 'resumen')  { loadResumenGetnet(); loadResumenPremios(); loadResumenComps(); }
  else if (tabId === 'getnet')   activateGnView(gnActiveView);
  else if (tabId === 'premios')  activatePnView(pnActiveView);
  else if (tabId === 'comps')    activateCpView(cpActiveView);
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
function _renderGnTable(tblId, rows, colDefs, totChkId, groupBy = null, sortsObj = gnSorts) {
  const body = document.getElementById('body' + tblId.replace('tbl',''));
  const foot = document.getElementById('foot' + tblId.replace('tbl',''));
  if (!body) return;
  const { col, dir } = sortsObj[tblId];
  const cols = colDefs.length;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty">Sin datos para los filtros seleccionados.</td></tr>`;
    if (foot) foot.hidden = true;
    return;
  }

  // Ordenar
  // Para 'hora': orden de jornada (10..23, luego 00..09)
  const _horaJornada = h => { const n = parseInt(h, 10); return n < 10 ? n + 24 : n; };

  const sorted = [...rows].sort((a, b) => {
    const va = a[col], vb = b[col];
    if (col === 'hora') {
      return (_horaJornada(va) - _horaJornada(vb)) * dir;
    }
    if (col === 'mes' || col === 'attendant' || col === 'categoria') {
      const ka = col === 'mes' ? a.year * 100 + a.month : String(va);
      const kb = col === 'mes' ? b.year * 100 + b.month : String(vb);
      return ka < kb ? -dir : ka > kb ? dir : 0;
    }
    if (typeof va === 'string' || typeof vb === 'string') {
      const sa = String(va ?? ''), sb = String(vb ?? '');
      return sa < sb ? -dir : sa > sb ? dir : 0;
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
    if (groupBy) {
      // Totales agrupados: una fila por valor único de groupBy
      const groups = {};
      rows.forEach(r => {
        const k = r[groupBy];
        if (!groups[k]) groups[k] = { [groupBy]: k };
        colDefs.forEach(cd => {
          if (cd.numeric) groups[k][cd.key] = (groups[k][cd.key] || 0) + (r[cd.key] || 0);
        });
      });
      const gRows = Object.values(groups).sort((a, b) => String(a[groupBy]).localeCompare(String(b[groupBy])));
      foot.innerHTML = gRows.map(gr => {
        const cells = colDefs.map(cd => {
          if (cd.key === groupBy)           return `<td class="gnh-td gnh-tot-label">${gr[groupBy]}</td>`;
          if (!cd.numeric || cd.sumKey === false) return `<td class="gnh-td">—</td>`;
          return `<td class="gnh-td numeric">${cd.fmt ? cd.fmt(gr[cd.key]) : (gr[cd.key] || 0).toLocaleString('es-CL')}</td>`;
        });
        return `<tr class="gnh-foot-row">${cells.join('')}</tr>`;
      }).join('');
    } else {
      // Total simple (una fila)
      const cells = colDefs.map((cd, i) => {
        if (cd.totLabel !== undefined) return `<td class="gnh-td${cd.numeric ? ' numeric' : ''} gnh-tot-label">${cd.totLabel}</td>`;
        if (i === 0) return `<td class="gnh-td gnh-tot-label">Total (${rows.length})</td>`;
        if (!cd.numeric || cd.sumKey === false) return `<td class="gnh-td">—</td>`;
        const s = rows.reduce((a, r) => a + (r[cd.key] || 0), 0);
        return `<td class="gnh-td numeric">${cd.fmt ? cd.fmt(s) : s.toLocaleString('es-CL')}</td>`;
      });
      foot.innerHTML = `<tr class="gnh-foot-row">${cells.join('')}</tr>`;
    }
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
    { key:'hora',       label:'Hora',        totLabel:'Total', fmt: v => `${String(v).padStart(2,'0')}:00` },
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
  ], 'totAttMes');

  // ⑤ Conteo Operaciones
  const rawConteo = d.rows_conteo || [];
  const totOps    = rawConteo.reduce((s, r) => s + (r.operaciones || 0), 0);
  const conteoRows = rawConteo.map(r => ({
    ...r,
    pct_ops: totOps ? r.operaciones / totOps * 100 : 0,
  }));
  _renderGnTable('tblConteo', conteoRows, [
    { key:'categoria',  label:'Forma de Pago' },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'pct_ops',    label:'%', numeric:true, sumKey:false, totLabel:'100%', fmt: v => v.toFixed(1) + '%' },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totConteo');
  _renderConteoChart(conteoRows);

  // ⑥ Total anual por asistente
  _renderGnTable('tblAnual', d.rows_anual || [], [
    { key:'attendant',  label:'Asistente'   },
    { key:'year',       label:'Año',         numeric:true, sumKey:false, fmt: v => String(v) },
    { key:'operaciones',label:'Operaciones', numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'monto',      label:'Monto',       numeric:true, fmt: v => clpFmt.format(v) },
  ], null);
}

/* ── Donut chart Conteo Operaciones ──────────────────────────────── */
function _renderConteoChart(rows) {
  const el = document.getElementById('chartConteo');
  if (!el || !rows.length) return;
  const COLORS = ['#d4af37','#4fd1c5','#f6ad55','#68d391','#9f7aea','#fc8181','#76e4f7'];
  new Chart(freshCanvas('chartConteo'), {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.categoria),
      datasets: [{
        data: rows.map(r => r.operaciones),
        backgroundColor: rows.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: '#1e1e2e',
        borderWidth: 3,
        hoverOffset: 10,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#c6c6c6', font: { size: 12, family: 'IBM Plex Sans' }, padding: 14, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${rows[ctx.dataIndex].pct_ops.toFixed(1)}%  —  ${rows[ctx.dataIndex].operaciones.toLocaleString('es-CL')} ops`
          }
        }
      }
    }
  });
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

/* ── Resumen Premios ─────────────────────────────── */
const resumenPremiosEl = document.getElementById('resumenPremios');

async function loadResumenPremios() {
  if (!resumenPremiosEl) return;
  resumenPremiosEl.innerHTML = '<p class="resumen-loading">Consultando base de datos…</p>';
  try {
    const res  = await fetch('/api/resumen/premios', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok)    { resumenPremiosEl.innerHTML = `<p class="resumen-error">${data.error}</p>`; return; }
    if (data.empty) { resumenPremiosEl.innerHTML = '<p class="resumen-empty">Sin datos — carga el primer Excel Premios.</p>'; return; }

    const jornada = new Date(data.ultima_jornada + 'T12:00:00')
      .toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

    resumenPremiosEl.innerHTML =
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
        `<small class="rc-sub">${data.total_operaciones.toLocaleString('es-CL')} premios</small>` +
      '</article>' +
      '<article class="resumen-card">' +
        '<span class="rc-label">Última jornada</span>' +
        `<strong class="rc-value mono">${clpFmt.format(data.monto_ultima_jornada)}</strong>` +
        `<small class="rc-sub">${data.ops_ultima_jornada.toLocaleString('es-CL')} premios · ${jornada}</small>` +
      '</article>';
  } catch {
    resumenPremiosEl.innerHTML = '<p class="resumen-error">Error de conexión al servidor.</p>';
  }
}

/* Cargar al inicio (tab Resumen activo por defecto) */
loadResumenGetnet();
loadResumenPremios();

/* ═══════════════════════════════════════════════════════════════
   PREMIOS — Histórico + Dashboard
   ═══════════════════════════════════════════════════════════════ */
let pnCharts     = {};
let pnActiveView = 'historico';
let pnAttLoaded  = false;
let pnTipoLoaded = false;
let pnHistData   = {};

const pnSorts = {
  tblPnMes:    { col:'mes',         dir:1  },
  tblPnHora:   { col:'hora',        dir:1  },
  tblPnRecord: { col:'operaciones', dir:-1 },
  tblPnAttMes: { col:'attendant',   dir:1  },
  tblPnTipo:   { col:'operaciones', dir:-1 },
  tblPnAnual:  { col:'operaciones', dir:-1 },
};

function activatePnView(view) {
  pnActiveView = view;
  document.querySelectorAll('.pn-subnav__btn').forEach(b =>
    b.classList.toggle('active', b.dataset.pnview === view)
  );
  const vHist = document.getElementById('pnViewHistorico');
  const vDash = document.getElementById('pnViewDashboard');
  if (vHist) vHist.hidden = (view !== 'historico');
  if (vDash) vDash.hidden = (view !== 'dashboard');
  if (view === 'historico') loadPnHistorico();
  else                      loadPnDashboard();
}

function _pnCheckedAttendants() {
  return [...document.querySelectorAll('#pnAttChecks .gnh-att-check:checked')].map(c => c.value);
}
function _pnCheckedTipos() {
  return [...document.querySelectorAll('.pn-tipo-check:checked')].map(c => c.value);
}

function _renderPnTipoChecks(tipos, container) {
  if (!tipos.length) { container.innerHTML = '<span class="gnh-att-empty">Sin tipos registrados</span>'; return; }
  container.innerHTML = tipos.map(t =>
    `<label class="gnh-att-item"><input type="checkbox" class="pn-tipo-check" value="${t}" checked><span>${t}</span></label>`
  ).join('');
  // re-bind change listeners sobre los nuevos elementos
  container.querySelectorAll('.pn-tipo-check').forEach(c =>
    c.addEventListener('change', () => loadPnHistorico())
  );
}

async function loadPnHistorico() {
  const yr  = yearFilter  ? yearFilter.value  : '';
  const mo  = monthFilter ? monthFilter.value : '';
  const att = pnAttLoaded ? _pnCheckedAttendants().join(',') : '';
  const tip = _pnCheckedTipos().join(',');
  const p   = new URLSearchParams();
  if (yr)  p.set('year',  yr);
  if (mo)  p.set('month', mo);
  if (att) p.set('attendants', att);
  if (tip) p.set('tipos', tip);

  const loadingBodies = [
    ['bodyPnMes',3],['bodyPnHora',3],['bodyPnRecord',3],
    ['bodyPnAttMes',4],['bodyPnTipo',4],['bodyPnAnual',4]
  ];
  loadingBodies.forEach(([id, cols]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty">Consultando…</td></tr>`;
  });

  try {
    const res  = await fetch(`/api/premios/historico?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      loadingBodies.forEach(([id, cols]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">${data.error}</td></tr>`;
      });
      return;
    }
    if (!pnAttLoaded) {
      const checks = document.getElementById('pnAttChecks');
      if (checks) _renderGnAttChecks(data.attendants, checks);
      pnAttLoaded = true;
    }
    if (!pnTipoLoaded) {
      const tipoChecks = document.getElementById('pnTipoChecks');
      if (tipoChecks) _renderPnTipoChecks(data.tipos, tipoChecks);
      pnTipoLoaded = true;
    }
    pnHistData = data;
    _renderAllPnTables();
  } catch {
    loadingBodies.forEach(([id, cols]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">Error de conexión.</td></tr>`;
    });
  }
}

function _renderAllPnTables() {
  const d = pnHistData;
  if (!d) return;
  const tipos = d.tipos || [];

  // ① Resumen Mensual: pivot por (year,month,mes) × tipo
  _renderPnPivot('tblPnMes', 'headPnMes', 'bodyPnMes', d.rows_mes || [], tipos, {
    groupKeys: ['year','month','mes'],
    labelCols: [{ key:'mes', label:'Mes' }],
    sortFn: (a,b) => a.year - b.year || a.month - b.month,
    footId: 'footPnMes', totId: 'totPnMes',
  });

  // ② Premios por Hora: pivot por hora × tipo
  _renderPnPivot('tblPnHora', 'headPnHora', 'bodyPnHora', d.rows_hora || [], tipos, {
    groupKeys: ['hora'],
    labelCols: [{ key:'hora', label:'Hora', fmt: v => `${String(v).padStart(2,'0')}:00` }],
    sortFn: (a,b) => a.hora - b.hora,
    footId: 'footPnHora', totId: 'totPnHora',
  });

  // ③ Record Asistentes: pivot por attendant × tipo
  _renderPnPivot('tblPnRecord', 'headPnRecord', 'bodyPnRecord', d.rows_record || [], tipos, {
    groupKeys: ['attendant'],
    labelCols: [{ key:'attendant', label:'Asistente' }],
    sortFn: (a,b) => (b._total || 0) - (a._total || 0),
    footId: 'footPnRecord', totId: 'totPnRecord',
  });

  // ④ Asistente por Mes: pivot por (attendant,year,month) × tipo
  _renderPnPivot('tblPnAttMes', 'headPnAttMes', 'bodyPnAttMes', d.rows_att_mes || [], tipos, {
    groupKeys: ['attendant','year','month','mes'],
    labelCols: [{ key:'attendant', label:'Asistente' }, { key:'mes', label:'Mes' }],
    sortFn: (a,b) => a.attendant.localeCompare(b.attendant) || a.year - b.year || a.month - b.month,
    footId: 'footPnAttMes', totId: 'totPnAttMes',
  });

  // ⑤ Tipo de Pago (sin cambios — ya es por tipo)
  const rawTipo  = d.rows_tipo || [];
  const totOpsT  = rawTipo.reduce((s, r) => s + (r.operaciones || 0), 0);
  const tipoRows = rawTipo.map(r => ({ ...r, pct_ops: totOpsT ? r.operaciones / totOpsT * 100 : 0 }));
  _renderGnTable('tblPnTipo', tipoRows, [
    { key:'categoria',   label:'Tipo de Pago' },
    { key:'operaciones', label:'Premios',  numeric:true, fmt: v => v.toLocaleString('es-CL') },
    { key:'pct_ops',     label:'%', numeric:true, sumKey:false, totLabel:'100%', fmt: v => v.toFixed(1) + '%' },
    { key:'monto',       label:'Monto',    numeric:true, fmt: v => clpFmt.format(v) },
  ], 'totPnTipo', null, pnSorts);
  _renderPnTipoChart(tipoRows);

  // ⑥ Total anual por asistente: pivot por (attendant,year) × tipo
  _renderPnPivot('tblPnAnual', 'headPnAnual', 'bodyPnAnual', d.rows_anual || [], tipos, {
    groupKeys: ['attendant','year'],
    labelCols: [{ key:'attendant', label:'Asistente' }, { key:'year', label:'Año' }],
    sortFn: (a,b) => a.attendant.localeCompare(b.attendant) || a.year - b.year,
  });

  // ⑦ Conteo Operaciones (igual)
  _renderPnConteoTable(d.rows_conteo || [], tipos);
}

// Pivot genérico: agrupa rows por groupKeys, crea una columna por tipo + Total
function _renderPnPivot(tblId, headId, bodyId, rows, tipos, opts) {
  const head = document.getElementById(headId);
  const body = document.getElementById(bodyId);
  if (!head || !body) return;

  const { groupKeys, labelCols, sortFn, footId, totId } = opts;
  const colspan = labelCols.length + (tipos.length || 1) + 1;

  if (!rows.length) {
    head.innerHTML = '<tr>' + labelCols.map(c => `<th class="gnh-th">${c.label}</th>`).join('') + '</tr>';
    body.innerHTML = `<tr><td colspan="${colspan}" class="gnh-empty">Sin datos</td></tr>`;
    if (footId) { const f = document.getElementById(footId); if (f) f.hidden = true; }
    return;
  }

  // Determine tipos present in data, ordered by API tipos
  const tiposInData = [...new Set(rows.map(r => r.tipo || 'Sin clasificar'))];
  const orderedTipos = tipos.length
    ? tipos.filter(t => tiposInData.includes(t)).concat(tiposInData.filter(t => !tipos.includes(t)))
    : tiposInData;

  // Build pivot map
  const pivotMap = new Map();
  for (const r of rows) {
    const k = groupKeys.map(g => r[g]).join('|||');
    if (!pivotMap.has(k)) {
      const obj = { counts:{}, _total:0 };
      for (const g of groupKeys) obj[g] = r[g];
      for (const lc of labelCols) if (r[lc.key] !== undefined) obj[lc.key] = r[lc.key];
      pivotMap.set(k, obj);
    }
    const o = pivotMap.get(k);
    const t = r.tipo || 'Sin clasificar';
    o.counts[t] = (o.counts[t] || 0) + (r.operaciones || 0);
    o._total += (r.operaciones || 0);
  }
  let pivotRows = [...pivotMap.values()];
  if (sortFn) pivotRows.sort(sortFn);

  // Header
  let thHtml = '<tr>';
  for (const lc of labelCols) thHtml += `<th class="gnh-th">${lc.label}</th>`;
  for (const t of orderedTipos) thHtml += `<th class="gnh-th numeric">${t}</th>`;
  thHtml += '<th class="gnh-th numeric">Total</th></tr>';
  head.innerHTML = thHtml;

  // Body
  const totals = {}; let grand = 0;
  for (const t of orderedTipos) totals[t] = 0;
  let html = '';
  for (const pr of pivotRows) {
    html += '<tr>';
    for (const lc of labelCols) {
      const v = pr[lc.key];
      html += `<td class="gnh-td">${lc.fmt ? lc.fmt(v) : (v == null ? '' : v)}</td>`;
    }
    for (const t of orderedTipos) {
      const v = pr.counts[t] || 0;
      totals[t] += v;
      html += `<td class="gnh-td gnh-td--num">${v > 0 ? v.toLocaleString('es-CL') : '<span class="gnh-zero">—</span>'}</td>`;
    }
    html += `<td class="gnh-td gnh-td--num"><strong>${pr._total.toLocaleString('es-CL')}</strong></td>`;
    grand += pr._total;
    html += '</tr>';
  }
  // Footer totals row
  html += '<tr class="gnh-foot">';
  for (let i = 0; i < labelCols.length; i++) {
    html += `<td class="gnh-td ${i === 0 ? 'gnh-foot__label' : ''}">${i === 0 ? 'Total' : ''}</td>`;
  }
  for (const t of orderedTipos) html += `<td class="gnh-td gnh-td--num gnh-foot__val">${totals[t].toLocaleString('es-CL')}</td>`;
  html += `<td class="gnh-td gnh-td--num gnh-foot__val">${grand.toLocaleString('es-CL')}</td></tr>`;
  body.innerHTML = html;

  if (totId) { const el = document.getElementById(totId); if (el) el.textContent = grand.toLocaleString('es-CL'); }
  if (footId) { const f = document.getElementById(footId); if (f) f.hidden = true; } // we put totals inside tbody
}

function _renderPnTipoChart(rows) {
  const el = document.getElementById('chartPnTipo');
  if (!el || !rows.length) return;
  const COLORS = ['#d4af37','#4fd1c5','#f6ad55','#68d391','#9f7aea','#fc8181','#76e4f7'];
  new Chart(freshCanvas('chartPnTipo'), {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.categoria),
      datasets: [{
        data: rows.map(r => r.operaciones),
        backgroundColor: rows.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: '#1e1e2e', borderWidth: 3, hoverOffset: 10,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position:'bottom', labels:{ color:'#c6c6c6', font:{ size:12, family:'IBM Plex Sans' }, padding:14, boxWidth:12 } },
        tooltip: { callbacks: { label: ctx => ` ${rows[ctx.dataIndex].pct_ops.toFixed(1)}%  —  ${rows[ctx.dataIndex].operaciones.toLocaleString('es-CL')} premios` } }
      }
    }
  });
}

function _renderPnConteoTable(rows, tipos) {
  const head = document.getElementById('headPnConteo');
  const body = document.getElementById('bodyPnConteo');
  if (!head || !body) return;

  if (!rows.length) {
    head.innerHTML = '<tr><th class="gnh-th">Mes</th><th class="gnh-th">Asistente</th></tr>';
    body.innerHTML = '<tr><td colspan="2" class="gnh-empty">Sin datos</td></tr>';
    return;
  }

  // Build ordered tipo list from actual data (preserve DB order via tipos array)
  const tiposInData = [...new Set(rows.map(r => r.tipo))];
  const orderedTipos = tipos.length
    ? tipos.filter(t => tiposInData.includes(t)).concat(tiposInData.filter(t => !tipos.includes(t)))
    : tiposInData;

  // Build pivot map: key = "mes|||attendant" → {mes, attendant, year, month, counts{tipo→n}}
  const pivotMap = new Map();
  for (const r of rows) {
    const k = `${r.year}|${String(r.month).padStart(2,'0')}|${r.attendant}`;
    if (!pivotMap.has(k)) pivotMap.set(k, { year:r.year, month:r.month, mes:r.mes, attendant:r.attendant, counts:{} });
    pivotMap.get(k).counts[r.tipo] = (pivotMap.get(k).counts[r.tipo] || 0) + r.count;
  }
  const pivotRows = [...pivotMap.values()].sort((a,b) => a.year - b.year || a.month - b.month || a.attendant.localeCompare(b.attendant));

  // Render header
  let thHtml = '<tr><th class="gnh-th sortable" data-col="mes">Mes <span class="sort-icon">↕</span></th>'
             + '<th class="gnh-th sortable" data-col="attendant">Asistente <span class="sort-icon">↕</span></th>';
  for (const t of orderedTipos) thHtml += `<th class="gnh-th sortable numeric" data-col="t_${t}">${t} <span class="sort-icon">↕</span></th>`;
  head.innerHTML = thHtml + '</tr>';

  // Totals row
  const totals = {};
  for (const t of orderedTipos) totals[t] = 0;
  for (const pr of pivotRows) for (const t of orderedTipos) totals[t] += (pr.counts[t] || 0);

  // Render body
  let html = '';
  let prevMes = null;
  for (const pr of pivotRows) {
    const mesCell = pr.mes !== prevMes ? `<td class="gnh-td">${pr.mes}</td>` : '<td class="gnh-td gnh-td--cont"></td>';
    prevMes = pr.mes;
    html += `<tr><td class="gnh-td">${pr.mes}</td><td class="gnh-td">${pr.attendant}</td>`;
    for (const t of orderedTipos) {
      const v = pr.counts[t] || 0;
      html += `<td class="gnh-td gnh-td--num">${v > 0 ? v.toLocaleString('es-CL') : '<span class="gnh-zero">—</span>'}</td>`;
    }
    html += '</tr>';
  }

  // Footer totals
  html += `<tr class="gnh-foot"><td class="gnh-td gnh-foot__label">Total</td><td class="gnh-td"></td>`;
  for (const t of orderedTipos) html += `<td class="gnh-td gnh-td--num gnh-foot__val">${totals[t].toLocaleString('es-CL')}</td>`;
  html += '</tr>';

  body.innerHTML = html;
}

async function loadPnDashboard() {
  const year  = yearFilter  ? yearFilter.value  : '';
  const month = monthFilter ? monthFilter.value : '';
  const params = new URLSearchParams();
  if (year)  params.set('year',  year);
  if (month) params.set('month', month);
  const url = `/api/premios/dashboard${params.toString() ? '?' + params : ''}`;
  const lbl = document.getElementById('pnYearLabel');
  if (lbl) {
    const monthName = month && monthFilter ? monthFilter.options[monthFilter.selectedIndex].text : '';
    lbl.textContent = [year || 'Todos', monthName].filter(Boolean).join(' · ');
  }
  try {
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) return;
    renderPnDashboard(data);
  } catch (err) { console.error('loadPnDashboard:', err); }
}

function renderPnDashboard({ por_mes, por_hora, heatmap, meta }) {
  Object.values(pnCharts).forEach(c => c.destroy());
  pnCharts = {};
  const gold = '#d4af37', teal = '#4fd1c5', blue = '#6699ff';
  const baseOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ color:'#c6c6c6' } } } };

  pnCharts.opsMes = new Chart(freshCanvas('chartPnOpsMes'), {
    type: 'bar',
    data: { labels: por_mes.map(r => r.mes_label),
            datasets: [{ label:'Premios', data: por_mes.map(r => r.operaciones),
                         backgroundColor: gold+'99', borderColor: gold, borderWidth:1 }] },
    options: { ...baseOpts, scales: gnScales() },
  });

  pnCharts.montosMes = new Chart(freshCanvas('chartPnMontosMes'), {
    type: 'line',
    data: { labels: por_mes.map(r => r.mes_label),
            datasets: [{ label:'Monto Total', data: por_mes.map(r => r.monto),
                         borderColor:teal, backgroundColor:teal+'33',
                         tension:0.3, fill:true, pointBackgroundColor:teal, pointRadius:4 }] },
    options: { ...baseOpts, scales: gnScales({ money:true }) },
  });

  const horaMap   = new Map(por_hora.map(r => [r.hora, r]));
  const horasSort = JORNADA_HOURS.filter(h => horaMap.has(h));

  pnCharts.opsHora = new Chart(freshCanvas('chartPnOpsHora'), {
    type: 'bar',
    data: { labels: horasSort,
            datasets: [{ label:'Promedio Premios', data: horasSort.map(h => horaMap.get(h).ops_prom),
                         backgroundColor: blue+'99', borderColor: blue, borderWidth:1 }] },
    options: { ...baseOpts, scales: gnScales() },
  });

  pnCharts.montosHora = new Chart(freshCanvas('chartPnMontosHora'), {
    type: 'line',
    data: { labels: horasSort,
            datasets: [{ label:'Promedio Monto ($)', data: horasSort.map(h => horaMap.get(h).monto_prom),
                         borderColor:gold, backgroundColor:gold+'33',
                         tension:0.3, fill:true, pointBackgroundColor:gold, pointRadius:4 }] },
    options: { ...baseOpts, scales: gnScales({ money:true }) },
  });

  renderPnHeatmap(heatmap, meta);
}

function renderPnHeatmap(rows, meta) {
  const metaEl = document.getElementById('pnHeatmapMeta');
  const wrapEl = document.getElementById('pnHeatmap');
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
      if (v === undefined) { html += `<td style="opacity:.25">—</td>`; }
      else {
        const a = (0.1 + (v / maxVal) * 0.85).toFixed(2);
        const bright = v / maxVal > 0.6;
        html += `<td style="background:rgba(212,175,55,${a});color:${bright ? '#000' : 'var(--cds-text-primary)'}">${v.toFixed(1)}</td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  wrapEl.innerHTML = html;
}

/* ── Sort / Accordion / Filtros Premios (delegados) ─────────── */
document.getElementById('pnViewHistorico')?.addEventListener('click', e => {
  const th = e.target.closest('.gnh-th.sortable');
  if (th) {
    const tbl = th.closest('table');
    if (!tbl) return;
    const tblId = tbl.id;
    if (!pnSorts[tblId]) return;
    const col = th.dataset.col;
    if (pnSorts[tblId].col === col) pnSorts[tblId].dir *= -1;
    else { pnSorts[tblId].col = col; pnSorts[tblId].dir = 1; }
    _renderAllPnTables();
    return;
  }
  const btn = e.target.closest('.gnh-acc-header');
  if (btn) {
    const acc = btn.closest('.gnh-acc');
    if (!acc) return;
    const isOpen = acc.dataset.open === 'true';
    acc.dataset.open = String(!isOpen);
    const body = acc.querySelector('.gnh-acc-body');
    if (body) body.hidden = isOpen;
  }
});

document.getElementById('pnViewHistorico')?.addEventListener('change', e => {
  if (e.target.closest('.gnh-tot-chk')) _renderAllPnTables();
});

document.getElementById('pnAttAll')?.addEventListener('click', () => {
  document.querySelectorAll('#pnAttChecks .gnh-att-check').forEach(c => c.checked = true);
  loadPnHistorico();
});
document.getElementById('pnAttNone')?.addEventListener('click', () => {
  document.querySelectorAll('#pnAttChecks .gnh-att-check').forEach(c => c.checked = false);
  loadPnHistorico();
});
document.getElementById('pnAttChecks')?.addEventListener('change', () => loadPnHistorico());

document.getElementById('pnTipoAll')?.addEventListener('click', () => {
  document.querySelectorAll('.pn-tipo-check').forEach(c => c.checked = true);
  loadPnHistorico();
});
document.getElementById('pnTipoNone')?.addEventListener('click', () => {
  document.querySelectorAll('.pn-tipo-check').forEach(c => c.checked = false);
  loadPnHistorico();
});
// los listeners de .pn-tipo-check individuales se registran en _renderPnTipoChecks

document.querySelectorAll('.pn-subnav__btn').forEach(b =>
  b.addEventListener('click', () => activatePnView(b.dataset.pnview))
);

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

/* ═══════════════════════════════════════════════════════════════
   COMPS — Histórico
   ═══════════════════════════════════════════════════════════════ */
const resumenCompsEl = document.getElementById('resumenComps');

async function loadResumenComps() {
  if (!resumenCompsEl) return;
  resumenCompsEl.innerHTML = '<p class="resumen-loading">Consultando base de datos…</p>';
  try {
    const res  = await fetch('/api/resumen/comps', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok)    { resumenCompsEl.innerHTML = `<p class="resumen-error">${data.error}</p>`; return; }
    if (data.empty) { resumenCompsEl.innerHTML = '<p class="resumen-empty">Sin datos — carga el primer Excel Comps.</p>'; return; }

    const jornada = new Date(data.ultima_jornada + 'T12:00:00')
      .toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });

    resumenCompsEl.innerHTML =
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
        '<span class="rc-label">Micros totales del mes</span>' +
        `<strong class="rc-value mono">${data.monto_total.toLocaleString('es-CL')}</strong>` +
        `<small class="rc-sub">${data.total_operaciones.toLocaleString('es-CL')} comps</small>` +
      '</article>' +
      '<article class="resumen-card">' +
        '<span class="rc-label">Última jornada</span>' +
        `<strong class="rc-value mono">${data.monto_ultima_jornada.toLocaleString('es-CL')}</strong>` +
        `<small class="rc-sub">${data.ops_ultima_jornada.toLocaleString('es-CL')} comps · ${jornada}</small>` +
      '</article>';
  } catch {
    resumenCompsEl.innerHTML = '<p class="resumen-error">Error de conexión al servidor.</p>';
  }
}

let cpActiveView   = 'historico';
let cpFiltersLoaded = false;
let cpCharts       = {};
let cpHistData     = {};

const cpSorts = {
  tblCpMes:     { col:'mes',         dir:1  },
  tblCpCat:     { col:'operaciones', dir:-1 },
  tblCpProd:    { col:'operaciones', dir:-1 },
  tblCpUsuario: { col:'operaciones', dir:-1 },
  tblCpEstado:  { col:'operaciones', dir:-1 },
  tblCpCliente: { col:'operaciones', dir:-1 },
};

function activateCpView(view) {
  cpActiveView = view;
  document.querySelectorAll('.cp-subnav__btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cpview === view)
  );
  const vHist = document.getElementById('cpViewHistorico');
  if (vHist) vHist.hidden = (view !== 'historico');
  if (view === 'historico') loadCpHistorico();
}

function _cpChecked(containerId, cls) {
  return [...document.querySelectorAll(`#${containerId} .${cls}:checked`)].map(c => c.value);
}

function _renderCpChecks(values, container, cls) {
  if (!values.length) { container.innerHTML = '<span class="gnh-att-empty">Sin datos</span>'; return; }
  container.innerHTML = values.map(v =>
    `<label class="gnh-att-item"><input type="checkbox" class="${cls}" value="${v}" checked><span>${v}</span></label>`
  ).join('');
  container.querySelectorAll(`.${cls}`).forEach(c =>
    c.addEventListener('change', () => loadCpHistorico())
  );
}

async function loadCpHistorico() {
  const yr  = yearFilter  ? yearFilter.value  : '';
  const mo  = monthFilter ? monthFilter.value : '';
  const usuarios   = cpFiltersLoaded ? _cpChecked('cpUsuarioChecks', 'cp-usuario-check').join(',') : '';
  const categorias = cpFiltersLoaded ? _cpChecked('cpCatChecks',     'cp-cat-check').join(',')     : '';
  const estados    = cpFiltersLoaded ? _cpChecked('cpEstadoChecks',  'cp-estado-check').join(',')  : '';
  const p   = new URLSearchParams();
  if (yr)  p.set('year',  yr);
  if (mo)  p.set('month', mo);
  if (usuarios)   p.set('usuarios',   usuarios);
  if (categorias) p.set('categorias', categorias);
  if (estados)    p.set('estados',    estados);

  const loadingBodies = [
    ['bodyCpMes',3],['bodyCpCat',4],['bodyCpProd',4],
    ['bodyCpUsuario',3],['bodyCpEstado',3],['bodyCpCliente',3]
  ];
  loadingBodies.forEach(([id, cols]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty">Consultando…</td></tr>`;
  });

  try {
    const res  = await fetch(`/api/comps/historico?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      loadingBodies.forEach(([id, cols]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">${data.error}</td></tr>`;
      });
      return;
    }

    if (!cpFiltersLoaded) {
      const cu = document.getElementById('cpUsuarioChecks');
      const cc = document.getElementById('cpCatChecks');
      const ce = document.getElementById('cpEstadoChecks');
      if (cu) _renderCpChecks(data.usuarios   || [], cu, 'cp-usuario-check');
      if (cc) _renderCpChecks(data.categorias || [], cc, 'cp-cat-check');
      if (ce) _renderCpChecks(data.estados    || [], ce, 'cp-estado-check');
      cpFiltersLoaded = true;
    }

    cpHistData = data;
    _renderAllCpTables(data);
  } catch (err) {
    loadingBodies.forEach(([id, cols]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<tr><td colspan="${cols}" class="gnh-empty error">Error de conexión.</td></tr>`;
    });
  }
}

function _renderAllCpTables(d) {
  const nFmt = v => (v || 0).toLocaleString('es-CL');
  const mFmt = v => '$' + (v || 0).toLocaleString('es-CL');

  // ── KPIs ───────────────────────────────────────────────
  const kpi = d.kpi || {};
  const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setEl('cpKpiTotal',    nFmt(kpi.total_comps));
  setEl('cpKpiMonto',    mFmt(kpi.total_monto));
  setEl('cpKpiClientes', nFmt(kpi.clientes_unicos));
  setEl('cpKpiCoinin',   mFmt(kpi.total_coinin));

  // ── Charts diario y weekday ───────────────────────────
  _renderCpDiarioChart(d.rows_diario || []);
  _renderCpWeekdayChart(d.rows_weekday || []);

  // ① Resumen Mensual — pivot por mes × estado
  _renderCpMesPivot(d.rows_mes || []);

  // ② Categoría con %
  const cats = d.rows_cat || [];
  const totOpsC = cats.reduce((s, r) => s + (r.operaciones || 0), 0);
  const catRows = cats.map(r => ({ ...r, pct_ops: totOpsC ? r.operaciones / totOpsC * 100 : 0 }));
  _renderGnTable('tblCpCat', catRows, [
    { key:'categoria',   label:'Categoría' },
    { key:'operaciones', label:'Cantidad',  numeric:true, fmt: nFmt },
    { key:'pct_ops',     label:'%', numeric:true, sumKey:false, totLabel:'100%', fmt: v => v.toFixed(1) + '%' },
    { key:'monto',       label:'Monto Total', numeric:true, fmt: mFmt },
  ], 'totCpCat', null, cpSorts);
  _renderCpCatChart(catRows);

  // ③ Producto
  _renderGnTable('tblCpProd', d.rows_prod || [], [
    { key:'producto',    label:'Producto' },
    { key:'categoria',   label:'Categoría' },
    { key:'operaciones', label:'Cantidad',  numeric:true, fmt: nFmt },
    { key:'monto',       label:'Monto', numeric:true, fmt: mFmt },
  ], 'totCpProd', null, cpSorts);

  // ④ Usuario
  _renderGnTable('tblCpUsuario', d.rows_usuario || [], [
    { key:'usuario',     label:'Usuario' },
    { key:'operaciones', label:'Cantidad',  numeric:true, fmt: nFmt },
    { key:'monto',       label:'Monto', numeric:true, fmt: mFmt },
  ], 'totCpUsuario', null, cpSorts);

  // ⑤ Estado
  _renderGnTable('tblCpEstado', d.rows_estado || [], [
    { key:'estado',      label:'Estado' },
    { key:'operaciones', label:'Cantidad',  numeric:true, fmt: nFmt },
    { key:'monto',       label:'Monto', numeric:true, fmt: mFmt },
  ], 'totCpEstado', null, cpSorts);

  // ⑥ Resumen por Jugador — Nivel + Coin-In + %
  const cliRows = (d.rows_cliente || []).map(r => {
    const coinin = r.coinin || 0;
    const monto  = r.monto  || 0;
    const pct    = coinin > 0 ? (monto / coinin * 100) : 0;
    return { ...r, coinin, pct, nivel: _cpNivel(coinin) };
  });
  _renderGnTable('tblCpCliente', cliRows, [
    { key:'cliente',     label:'Nombre' },
    { key:'nivel',       label:'Nivel', fmt: v => `<span class="cp-nivel-badge ${_cpNivelCls(v)}">${v}</span>`, sumKey:false },
    { key:'operaciones', label:'Cortesías',       numeric:true, fmt: nFmt },
    { key:'monto',       label:'Monto Cortesías', numeric:true, fmt: mFmt },
    { key:'coinin',      label:'Coin-In Total',   numeric:true, fmt: mFmt },
    { key:'pct',         label:'% Cortesía/Coin-In', numeric:true, sumKey:false, fmt: v => v.toFixed(2) + '%' },
  ], 'totCpCliente', null, cpSorts);
}

/* ── Cortesías por Día ─────────────────────────────────── */
function _renderCpDiarioChart(rows) {
  if (cpCharts.diario) cpCharts.diario.destroy();
  const canvas = freshCanvas ? freshCanvas('chartCpDiario') : document.getElementById('chartCpDiario');
  if (!canvas) return;
  cpCharts.diario = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.fecha),
      datasets: [{
        label: 'Monto Cortesías',
        data: rows.map(r => r.monto),
        backgroundColor: 'rgba(78,160,255,0.85)',
        borderColor: '#4ea0ff', borderWidth: 1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color:'#c6c6c6' } } },
      scales: {
        x: { ticks: { color:'#8d8d8d', maxRotation:60, minRotation:60, font:{ size:10 } }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y: { ticks: { color:'#8d8d8d', callback: v => v.toLocaleString('es-CL') }, grid:{ color:'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

/* ── Promedio por día de la semana ────────────────────── */
function _renderCpWeekdayChart(rows) {
  if (cpCharts.weekday) cpCharts.weekday.destroy();
  const canvas = freshCanvas ? freshCanvas('chartCpWeekday') : document.getElementById('chartCpWeekday');
  if (!canvas) return;
  // DOW Postgres: 0=Domingo, 1=Lunes … 6=Sábado → reordeno Lun…Dom
  const order = [1,2,3,4,5,6,0];
  const labels = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const byDow = new Map((rows || []).map(r => [r.dow, r]));
  const cant = [], mont = [], nFechas = [];
  for (const dow of order) {
    const r = byDow.get(dow);
    const n = r?.n_fechas || 0;
    nFechas.push(n);
    cant.push(n ? (r.operaciones / n) : 0);
    mont.push(n ? (r.monto / n) : 0);
  }
  // Render tags arriba del chart
  const tagsEl = document.getElementById('cpWeekdayTags');
  if (tagsEl) {
    const short = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    tagsEl.innerHTML = short.map((s,i) => `<span class="cp-weekday-tag">${s}: n=${nFechas[i]}</span>`).join('');
  }
  cpCharts.weekday = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels.map((l,i) => `${l} (n=${nFechas[i]})`),
      datasets: [
        { label:'Monto Promedio ($)', data: mont, backgroundColor:'rgba(43,217,159,0.85)', borderColor:'#2bd99f', borderWidth:1, yAxisID:'y' },
        { label:'Cantidad Promedio (cortesías)', data: cant, backgroundColor:'rgba(244,124,67,0.85)', borderColor:'#f47c43', borderWidth:1, yAxisID:'y1' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color:'#c6c6c6' } } },
      scales: {
        x:  { ticks: { color:'#8d8d8d' }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y:  { position:'left',  ticks:{ color:'#2bd99f', callback: v => '$' + v.toLocaleString('es-CL') }, grid:{ color:'rgba(255,255,255,0.06)' }, title:{ display:true, text:'Monto promedio ($)', color:'#2bd99f' } },
        y1: { position:'right', ticks:{ color:'#f47c43' }, grid:{ display:false }, title:{ display:true, text:'Cantidad promedio', color:'#f47c43' } }
      }
    }
  });
}

/* ── Niveles del jugador por Coin-In ──────────────────── */
function _cpNivel(coinin) {
  if (coinin >= 50_000_000)  return 'DREAMS PLATINUM';
  if (coinin >= 10_000_000)  return 'DREAMS GOLD';
  if (coinin >=  1_000_000)  return 'DREAMS SILVER';
  return 'DREAMS CLASSIC';
}
function _cpNivelCls(nivel) {
  if (nivel === 'DREAMS GOLD')    return 'nivel-gold';
  if (nivel === 'DREAMS SILVER')  return 'nivel-silver';
  if (nivel === 'DREAMS CLASSIC') return 'nivel-classic';
  return '';
}

// Pivot Resumen Mensual: filas por mes, columnas por estado
function _renderCpMesPivot(rows) {
  const head = document.getElementById('headCpMes');
  const body = document.getElementById('bodyCpMes');
  const foot = document.getElementById('footCpMes');
  if (!head || !body) return;

  if (!rows.length) {
    head.innerHTML = '<tr><th class="gnh-th">Mes</th><th class="gnh-th numeric">Comps</th><th class="gnh-th numeric">Micros</th></tr>';
    body.innerHTML = '<tr><td colspan="3" class="gnh-empty">Sin datos.</td></tr>';
    if (foot) foot.hidden = true;
    return;
  }

  const estados = [...new Set(rows.map(r => r.estado))].sort();
  const mapa = new Map();
  for (const r of rows) {
    const k = `${r.year}-${String(r.month).padStart(2,'0')}`;
    if (!mapa.has(k)) mapa.set(k, { year:r.year, month:r.month, mes:r.mes, ops:{}, mts:{} });
    const x = mapa.get(k);
    x.ops[r.estado] = (x.ops[r.estado] || 0) + r.operaciones;
    x.mts[r.estado] = (x.mts[r.estado] || 0) + r.monto;
  }
  const ordered = [...mapa.values()].sort((a,b) => a.year - b.year || a.month - b.month);

  let thHtml = '<tr><th class="gnh-th">Mes</th>';
  for (const e of estados) thHtml += `<th class="gnh-th numeric" colspan="2">${e}</th>`;
  thHtml += '<th class="gnh-th numeric">Total Comps</th><th class="gnh-th numeric">Total Micros</th></tr>';
  thHtml += '<tr><th class="gnh-th"></th>';
  for (const _e of estados) thHtml += '<th class="gnh-th numeric">Comps</th><th class="gnh-th numeric">Micros</th>';
  thHtml += '<th class="gnh-th"></th><th class="gnh-th"></th></tr>';
  head.innerHTML = thHtml;

  let html = '';
  const totals = { ops:{}, mts:{}, tOps:0, tMts:0 };
  for (const e of estados) { totals.ops[e] = 0; totals.mts[e] = 0; }
  for (const r of ordered) {
    let tOps = 0, tMts = 0;
    html += `<tr><td class="gnh-td">${r.mes}</td>`;
    for (const e of estados) {
      const op = r.ops[e] || 0;
      const mt = r.mts[e] || 0;
      tOps += op; tMts += mt;
      totals.ops[e] += op; totals.mts[e] += mt;
      html += `<td class="gnh-td numeric">${op ? op.toLocaleString('es-CL') : '<span class="gnh-zero">—</span>'}</td>`;
      html += `<td class="gnh-td numeric">${mt ? mt.toLocaleString('es-CL') : '<span class="gnh-zero">—</span>'}</td>`;
    }
    html += `<td class="gnh-td numeric"><strong>${tOps.toLocaleString('es-CL')}</strong></td>`;
    html += `<td class="gnh-td numeric"><strong>${tMts.toLocaleString('es-CL')}</strong></td></tr>`;
    totals.tOps += tOps; totals.tMts += tMts;
  }
  body.innerHTML = html;

  if (foot) {
    const showTot = document.getElementById('totCpMes')?.checked;
    foot.hidden = !showTot;
    if (showTot) {
      let f = '<tr class="gnh-foot-row"><td class="gnh-td gnh-tot-label">Total</td>';
      for (const e of estados) {
        f += `<td class="gnh-td numeric">${totals.ops[e].toLocaleString('es-CL')}</td>`;
        f += `<td class="gnh-td numeric">${totals.mts[e].toLocaleString('es-CL')}</td>`;
      }
      f += `<td class="gnh-td numeric"><strong>${totals.tOps.toLocaleString('es-CL')}</strong></td>`;
      f += `<td class="gnh-td numeric"><strong>${totals.tMts.toLocaleString('es-CL')}</strong></td></tr>`;
      foot.innerHTML = f;
    }
  }
}

function _renderCpCatChart(rows) {
  if (cpCharts.cat) cpCharts.cat.destroy();
  const canvas = freshCanvas ? freshCanvas('chartCpCat') : document.getElementById('chartCpCat');
  if (!canvas) return;
  const palette = ['#d4af37', '#4fd1c5', '#6699ff', '#f48fb1', '#a78bfa', '#fbbf24', '#34d399', '#fb7185'];
  cpCharts.cat = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.categoria),
      datasets: [{ data: rows.map(r => r.operaciones),
                   backgroundColor: rows.map((_,i) => palette[i % palette.length]),
                   borderColor: '#161616', borderWidth: 2 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position:'bottom', labels:{ color:'#c6c6c6', font:{ size:12, family:'IBM Plex Sans' }, padding:14, boxWidth:12 } },
        tooltip: { callbacks: { label: ctx => ` ${rows[ctx.dataIndex].pct_ops.toFixed(1)}%  —  ${rows[ctx.dataIndex].operaciones.toLocaleString('es-CL')} comps` } }
      }
    }
  });
}

// Toggle totales para tablas Comps
['totCpCat','totCpProd','totCpUsuario','totCpEstado','totCpCliente','totCpMes'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => {
    if (cpHistData && cpHistData.rows_mes !== undefined) _renderAllCpTables(cpHistData);
  });
});

// Sort + Accordion delegados sobre cpViewHistorico
document.getElementById('cpViewHistorico')?.addEventListener('click', e => {
  const th = e.target.closest('.gnh-th.sortable');
  if (th) {
    const tbl = th.closest('table');
    if (!tbl) return;
    const tblId = tbl.id;
    if (!cpSorts[tblId]) return;
    const col = th.dataset.col;
    if (cpSorts[tblId].col === col) cpSorts[tblId].dir *= -1;
    else { cpSorts[tblId].col = col; cpSorts[tblId].dir = 1; }
    if (cpHistData && cpHistData.rows_mes !== undefined) _renderAllCpTables(cpHistData);
    return;
  }
  const btn = e.target.closest('.gnh-acc-header');
  if (btn) {
    const acc = btn.closest('.gnh-acc');
    if (!acc) return;
    const isOpen = acc.dataset.open === 'true';
    acc.dataset.open = String(!isOpen);
    const body = acc.querySelector('.gnh-acc-body');
    if (body) body.hidden = isOpen;
  }
});

// Filtros "Todos / Ninguno" por bloque
[['cpUsuarioAll','cpUsuarioNone','cp-usuario-check'],
 ['cpCatAll','cpCatNone','cp-cat-check'],
 ['cpEstadoAll','cpEstadoNone','cp-estado-check']].forEach(([allId, noneId, cls]) => {
  const bAll  = document.getElementById(allId);
  const bNone = document.getElementById(noneId);
  if (bAll)  bAll.addEventListener('click', () => {
    document.querySelectorAll(`.${cls}`).forEach(c => c.checked = true);
    loadCpHistorico();
  });
  if (bNone) bNone.addEventListener('click', () => {
    document.querySelectorAll(`.${cls}`).forEach(c => c.checked = false);
    loadCpHistorico();
  });
});

// Sub-nav comps + acordeones
document.querySelectorAll('.cp-subnav__btn').forEach(btn => {
  btn.addEventListener('click', () => activateCpView(btn.dataset.cpview));
});

// Cargar al inicio (tile Resumen Comps)
loadResumenComps();

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
  yearFilter.value  = String(new Date().getFullYear());
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
[showTotals].forEach((el) => el.addEventListener("change", () => {
  renderRows();
  // Sincronizar todos los checkboxes de totales en las tablas Histórico
  document.querySelectorAll('.gnh-tot-chk').forEach(chk => {
    chk.checked = showTotals.checked;
  });
  const activeTab = document.querySelector(".header-tab.active")?.dataset.tab;
  if (activeTab === "getnet" && gnActiveView === "historico") _renderAllGnTables();
  else if (activeTab === "premios" && pnActiveView === "historico") _renderAllPnTables();
}));
nameFilter.addEventListener("input", renderRows);
applyFilter.addEventListener("click", () => {
  const activeTab = document.querySelector(".header-tab.active")?.dataset.tab;
  if (activeTab === "getnet") {
    gnAttLoaded = false;
    activateGnView(gnActiveView);
  } else if (activeTab === "premios") {
    pnAttLoaded  = false;
    pnTipoLoaded = false;
    activatePnView(pnActiveView);
  } else if (activeTab === "comps") {
    cpFiltersLoaded = false;
    activateCpView(cpActiveView);
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
