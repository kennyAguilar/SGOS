const reportData = [
  { room: "Norte", machine: "MX-104", date: "2026-05-06 08:00", srw: 12450.75, sgos: 12450.75 },
  { room: "Norte", machine: "MX-118", date: "2026-05-06 08:00", srw: 8320.5, sgos: 8301.35 },
  { room: "Centro", machine: "CX-021", date: "2026-05-06 08:30", srw: 15220, sgos: 15109.25 },
  { room: "Centro", machine: "CX-033", date: "2026-05-06 08:30", srw: 9040, sgos: 9040 },
  { room: "Sur", machine: "SX-072", date: "2026-05-06 09:00", srw: 18675.8, sgos: 18332.45 },
  { room: "Sur", machine: "SX-088", date: "2026-05-06 09:00", srw: 10560.4, sgos: 10508.15 },
  { room: "Norte", machine: "MX-121", date: "2026-05-06 09:15", srw: 7210.25, sgos: 7210.25 },
  { room: "Centro", machine: "CX-045", date: "2026-05-06 09:30", srw: 11350.9, sgos: 11350.9 },
  { room: "Sur", machine: "SX-091", date: "2026-05-06 09:45", srw: 9995.2, sgos: 9811.05 }
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const appShell = document.querySelector(".app-shell");
const rowsTarget = document.querySelector("#reportRows");
const roomFilter = document.querySelector("#roomFilter");
const statusFilter = document.querySelector("#statusFilter");
const diffOnly = document.querySelector("#diffOnly");
const tooltip = document.querySelector("#tooltip");
const skeletonTable = document.querySelector("#skeletonTable");
const gridWrap = document.querySelector("#gridWrap");

function getStatus(row) {
  const difference = row.srw - row.sgos;
  const percent = Math.abs(difference / row.srw) * 100;

  if (difference === 0) {
    return { key: "ok", label: "Exacta", className: "ok" };
  }

  if (percent < 1) {
    return { key: "warn", label: "Atencion", className: "warn" };
  }

  return { key: "error", label: "Critico", className: "error" };
}

function getFilteredRows() {
  return reportData.filter((row) => {
    const status = getStatus(row);
    const matchesRoom = roomFilter.value === "all" || row.room === roomFilter.value;
    const matchesStatus = statusFilter.value === "all" || status.key === statusFilter.value;
    const matchesDiff = !diffOnly.checked || status.key !== "ok";

    return matchesRoom && matchesStatus && matchesDiff;
  });
}

function renderRows() {
  const rows = getFilteredRows();

  rowsTarget.innerHTML = rows.map((row) => {
    const status = getStatus(row);
    const difference = row.srw - row.sgos;
    const percent = Math.abs(difference / row.srw) * 100;
    const differenceClass = status.key === "ok" ? "success-text" : status.key === "warn" ? "warn-text" : "error-text";
    const criticalClass = status.key === "error" ? " class=\"critical-row\"" : "";

    return `
      <tr${criticalClass}>
        <td>${row.room}</td>
        <td class="mono">${row.machine}</td>
        <td class="mono">${row.date}</td>
        <td class="numeric mono" data-tooltip="SRW registrado para ${row.machine}">${currency.format(row.srw)}</td>
        <td class="numeric mono" data-tooltip="SGOS procesado para ${row.machine}">${currency.format(row.sgos)}</td>
        <td class="numeric mono ${differenceClass}" data-tooltip="SRW: ${currency.format(row.srw)} | SGOS: ${currency.format(row.sgos)} | Variacion: ${percent.toFixed(2)}%">${currency.format(difference)}</td>
        <td><span class="pill ${status.className}"><i class="dot ${status.key === "ok" ? "success" : status.key === "warn" ? "warning" : "danger"}"></i>${status.label}</span></td>
      </tr>
    `;
  }).join("");

  if (!rows.length) {
    rowsTarget.innerHTML = `<tr><td colspan="7" class="empty-state">No hay cortes que coincidan con los filtros.</td></tr>`;
  }
}

function showSkeleton() {
  skeletonTable.hidden = false;
  gridWrap.hidden = true;

  window.setTimeout(() => {
    skeletonTable.hidden = true;
    gridWrap.hidden = false;
    renderRows();
  }, 800);
}

function exportCsv() {
  const headers = ["Sala", "Maquina", "Fecha corte", "SRW", "SGOS", "Diferencia", "Estado QA"];
  const lines = getFilteredRows().map((row) => {
    const status = getStatus(row);
    return [row.room, row.machine, row.date, row.srw.toFixed(2), row.sgos.toFixed(2), (row.srw - row.sgos).toFixed(2), status.label].join(",");
  });
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sgos-cuadratura.csv";
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector("#toggleFilters").addEventListener("click", () => {
  const isOpen = appShell.dataset.filterOpen === "true";
  appShell.dataset.filterOpen = String(!isOpen);
});

document.querySelector("#loadDemo").addEventListener("click", showSkeleton);
document.querySelector("#exportCsv").addEventListener("click", exportCsv);

[roomFilter, statusFilter, diffOnly].forEach((control) => {
  control.addEventListener("change", renderRows);
});

document.addEventListener("mouseover", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (!target) {
    return;
  }

  tooltip.innerHTML = `<strong>Detalle</strong>${target.dataset.tooltip}`;
  tooltip.hidden = false;
});

document.addEventListener("mousemove", (event) => {
  if (tooltip.hidden) {
    return;
  }

  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
});

document.addEventListener("mouseout", (event) => {
  if (!event.target.closest("[data-tooltip]")) {
    return;
  }

  tooltip.hidden = true;
});

renderRows();