/* ==========================================================
   STICK UP CALCULATOR — script.js
   Rumus inti: Stick Up = Depth dari Casing - Depth dari NGL
   ========================================================== */

const STORAGE_KEY = "stickup_batch_rows_v1";
const BATAS_BAWAH = 0;
const BATAS_ATAS = 1.5;

/* ---------------- Rumus & QAQC ---------------- */

function hitungStickUp(depthNgl, depthCasing) {
  const su = depthCasing - depthNgl;
  return Math.round(su * 1000) / 1000;
}

function validasiStickUp(stickUp) {
  if (Number.isNaN(stickUp)) {
    return { label: "belum lengkap", cls: "" };
  }
  if (stickUp < BATAS_BAWAH) {
    return { label: "Tidak valid", cls: "badge--bad" };
  }
  if (stickUp > BATAS_ATAS) {
    return { label: "Periksa ulang", cls: "badge--warn" };
  }
  return { label: "OK", cls: "badge--ok" };
}

/* ---------------- Kalkulator single-hole ---------------- */

const depthNglInput = document.getElementById("depthNgl");
const depthCasingInput = document.getElementById("depthCasing");
const holeIdInput = document.getElementById("holeId");
const resultNumber = document.getElementById("resultNumber");
const resultBadge = document.getElementById("resultBadge");
const addToTableBtn = document.getElementById("addToTableBtn");

const dimLine = document.getElementById("dimLine");
const dimLabel = document.getElementById("dimLabel");
const casingPipe = document.getElementById("casingPipe");

const GROUND_Y = 210;
const MIN_PIPE_TOP = 60;   // batas atas svg biar nggak nabrak awan
const MAX_PIPE_TOP = 205;  // batas bawah, stick up nyaris 0

function updateDiagram(stickUp) {
  // skala visual biar tetap enak dilihat walau angka aslinya kecil/besar
  const clamped = Math.max(0, Math.min(stickUp || 0, 2));
  const pxPerMeter = 90;
  let pipeTop = GROUND_Y - (clamped * pxPerMeter) - 30;
  pipeTop = Math.max(MIN_PIPE_TOP, Math.min(pipeTop, MAX_PIPE_TOP));

  casingPipe.setAttribute("y", pipeTop);
  casingPipe.setAttribute("height", GROUND_Y - pipeTop + 10);

  dimLine.setAttribute("y1", pipeTop + 5);
  dimLabel.setAttribute("y", (pipeTop + 5 + GROUND_Y) / 2 + 5);

  dimLabel.textContent = Number.isNaN(stickUp) ? "– m" : `${stickUp.toFixed(2)} m`;
}

function hitungDanTampilkan() {
  const dNgl = parseFloat(depthNglInput.value);
  const dCasing = parseFloat(depthCasingInput.value);

  if (Number.isNaN(dNgl) || Number.isNaN(dCasing)) {
    resultNumber.textContent = "–";
    resultBadge.textContent = "isi dua kolom dulu ya";
    resultBadge.className = "badge";
    updateDiagram(NaN);
    return null;
  }

  const su = hitungStickUp(dNgl, dCasing);
  const status = validasiStickUp(su);

  resultNumber.textContent = su.toFixed(3);
  resultBadge.textContent = status.label;
  resultBadge.className = `badge ${status.cls}`;
  updateDiagram(su);

  return { holeId: holeIdInput.value.trim() || `DH-${String(rows.length + 1).padStart(3, "0")}`, dNgl, dCasing, su };
}

[depthNglInput, depthCasingInput].forEach((el) => {
  el.addEventListener("input", hitungDanTampilkan);
});

/* ---------------- Batch table ---------------- */

let rows = [];      // { id, holeId, dNgl, dCasing }
let rowCounter = 0;

const tableBody = document.getElementById("tableBody");
const tableEmpty = document.getElementById("tableEmpty");
const addRowBtn = document.getElementById("addRowBtn");
const exportBtn = document.getElementById("exportBtn");
const csvInput = document.getElementById("csvInput");

function muatDariStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      rows = parsed.rows || [];
      rowCounter = parsed.rowCounter || rows.length;
    }
  } catch (e) {
    console.warn("Gagal memuat data tersimpan:", e);
  }
}

function simpanKeStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, rowCounter }));
  } catch (e) {
    console.warn("Gagal menyimpan data:", e);
  }
}

function tambahBaris(data = {}) {
  rowCounter += 1;
  rows.push({
    id: rowCounter,
    holeId: data.holeId ?? `DH-${String(rowCounter).padStart(3, "0")}`,
    dNgl: data.dNgl ?? "",
    dCasing: data.dCasing ?? "",
  });
  renderTable();
  simpanKeStorage();
}

function hapusBaris(id) {
  rows = rows.filter((r) => r.id !== id);
  renderTable();
  simpanKeStorage();
}

function updateBaris(id, field, value) {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  row[field] = value;
  renderTable(false); // false: nggak perlu re-render input, cukup update stick up & status
  simpanKeStorage();
}

function renderTable(fullRebuild = true) {
  tableEmpty.style.display = rows.length === 0 ? "block" : "none";

  if (fullRebuild) {
    tableBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.dataset.id = row.id;
      tr.innerHTML = `
        <td><input type="text" value="${escapeAttr(row.holeId)}" data-field="holeId"></td>
        <td><input type="number" step="0.01" value="${row.dNgl}" data-field="dNgl"></td>
        <td><input type="number" step="0.01" value="${row.dCasing}" data-field="dCasing"></td>
        <td class="stickup-cell" data-role="stickup">–</td>
        <td data-role="status"><span class="badge">–</span></td>
        <td><button class="row-delete" title="Hapus baris" aria-label="Hapus baris">✕</button></td>
      `;

      tr.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", (e) => {
          updateBaris(row.id, e.target.dataset.field, e.target.value);
        });
      });
      tr.querySelector(".row-delete").addEventListener("click", () => hapusBaris(row.id));

      tableBody.appendChild(tr);
    });
  }

  // update kolom stick up & status untuk semua baris (tanpa rebuild input)
  rows.forEach((row) => {
    const tr = tableBody.querySelector(`tr[data-id="${row.id}"]`);
    if (!tr) return;
    const dNgl = parseFloat(row.dNgl);
    const dCasing = parseFloat(row.dCasing);
    const su = hitungStickUp(dNgl, dCasing);
    const status = validasiStickUp(su);

    tr.querySelector('[data-role="stickup"]').textContent = Number.isNaN(su) ? "–" : su.toFixed(3);
    const badgeEl = tr.querySelector('[data-role="status"] .badge');
    badgeEl.textContent = Number.isNaN(su) ? "–" : status.label;
    badgeEl.className = `badge ${Number.isNaN(su) ? "" : status.cls}`;
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

addRowBtn.addEventListener("click", () => tambahBaris());

addToTableBtn.addEventListener("click", () => {
  const hasil = hitungDanTampilkan();
  if (hasil) {
    tambahBaris({ holeId: hasil.holeId, dNgl: hasil.dNgl, dCasing: hasil.dCasing });
  }
});

/* ---------------- Export CSV ---------------- */

function exportCSV() {
  const header = ["hole_id", "depth_dari_ngl", "depth_dari_casing", "stick_up", "status"];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const dNgl = parseFloat(row.dNgl);
    const dCasing = parseFloat(row.dCasing);
    const su = hitungStickUp(dNgl, dCasing);
    const status = validasiStickUp(su);
    lines.push([
      row.holeId,
      Number.isNaN(dNgl) ? "" : dNgl,
      Number.isNaN(dCasing) ? "" : dCasing,
      Number.isNaN(su) ? "" : su,
      Number.isNaN(su) ? "" : status.label,
    ].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hasil_stick_up.csv";
  a.click();
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener("click", exportCSV);

/* ---------------- Import CSV ---------------- */

function normalisasiHeader(h) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) return;

    const header = lines[0].split(",").map(normalisasiHeader);
    const idxHole = header.findIndex((h) => h.includes("hole"));
    const idxNgl = header.findIndex((h) => h.includes("ngl"));
    const idxCasing = header.findIndex((h) => h.includes("casing"));

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      tambahBaris({
        holeId: idxHole >= 0 ? cols[idxHole]?.trim() : undefined,
        dNgl: idxNgl >= 0 ? cols[idxNgl]?.trim() : "",
        dCasing: idxCasing >= 0 ? cols[idxCasing]?.trim() : "",
      });
    }
  };
  reader.readAsText(file);
}

csvInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importCSV(file);
  csvInput.value = "";
});

/* ---------------- Init ---------------- */

muatDariStorage();
renderTable();
updateDiagram(0.55); // nilai demo awal biar diagram nggak kosong
