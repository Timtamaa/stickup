/* ==========================================================
   STICK-UP GAUGE — simulasi per interval pengeboran

   Rumus dasar:
     Stick Up = Panjang Pipa Total + Core Barrel − Total Kedalaman

   Simulasi berjalan tiap kelipatan 1 interval (default 1 m).
   Sebelum tiap interval dijalankan, sistem cek apakah stick up
   akan jatuh di bawah batas minimum aman (default 0,6 m). Jika
   ya, satu pipa ditambahkan dulu ke rangkaian:
     - Pipa standar (3 m) selalu tersedia (wajib).
     - Pipa opsional (1,5 m), jika diaktifkan, dipakai lebih dulu.
       Begitu jumlah pipa opsional AKTIF mencapai batas (default 2
       batang = 3 m), keduanya dicatat setara 1 pipa standar di
       rekap jumlah pipa, lalu opsi pipa 1,5 m tersedia lagi untuk
       siklus berikutnya (bukan cuma sekali seumur simulasi).

   Pola yang dihasilkan (default): pipa standar -> 2,60 / 1,60 /
   0,60 berulang (maks 2,60 m, min 0,60 m). Pipa opsional -> 1,60 /
   0,60 / 1,10 berulang sebelum konsolidasi ke pipa standar.
   ========================================================== */

const els = {
  targetDepth: document.getElementById('targetDepth'),
  useSupport: document.getElementById('useSupport'),
  calcBtn: document.getElementById('calcBtn'),
  advToggle: document.getElementById('advToggle'),
  advancedPanel: document.getElementById('advancedPanel'),
  cbLength: document.getElementById('cbLength'),
  interval: document.getElementById('interval'),
  safeMin: document.getElementById('safeMin'),
  standardLen: document.getElementById('standardLen'),
  supportLen: document.getElementById('supportLen'),
  maxSupport: document.getElementById('maxSupport'),
  errorBox: document.getElementById('errorBox'),
  statusLamp: document.getElementById('statusLamp'),
  statusText: document.getElementById('statusText'),
  outStickUp: document.getElementById('outStickUp'),
  outLastMeter: document.getElementById('outLastMeter'),
  outPipeCount: document.getElementById('outPipeCount'),
  outStandard: document.getElementById('outStandard'),
  outActiveSupport: document.getElementById('outActiveSupport'),
  outCB: document.getElementById('outCB'),
  outSupportUsedTotal: document.getElementById('outSupportUsedTotal'),
  progressBody: document.getElementById('progressBody'),
};

/* ---------- advanced settings toggle ---------- */
els.advToggle.addEventListener('click', () => {
  const isOpen = els.advancedPanel.classList.toggle('open');
  els.advToggle.textContent = isOpen ? 'Pengaturan lanjutan ⌃' : 'Pengaturan lanjutan ⌄';
});

/* ---------- core simulation ---------- */
function simulateStickUp(targetDepth, cb, interval, safeMin, standardLen, supportLen, maxSupport, useSupport) {
  if (isNaN(targetDepth) || targetDepth <= 0) {
    return { error: 'Kedalaman target harus lebih besar dari 0.' };
  }
  if (cb <= 0 || interval <= 0 || standardLen <= 0 || (useSupport && supportLen <= 0)) {
    return { error: 'Semua panjang komponen dan interval harus lebih besar dari 0.' };
  }
  if (isNaN(safeMin) || safeMin < 0) safeMin = 0;
  if (isNaN(maxSupport) || maxSupport < 1) maxSupport = 1;

  const N = Math.round(targetDepth / interval);
  if (N <= 0) {
    return { error: 'Kedalaman target terlalu kecil untuk satu interval pengeboran.' };
  }

  let state = cb;
  let activeSupport = 0;        // pipa opsional aktif, belum ditukar (reset tiap kali mencapai maxSupport)
  let supportUsedLifetime = 0;  // total pipa opsional dipakai sepanjang simulasi (untuk tampilan saja)
  let standardCount = 0;        // total pipa standar (langsung + hasil konversi pipa opsional)
  const sequence = [];

  for (let m = 1; m <= N; m++) {
    const events = [];
    let guard = 0;

    while (state - interval < safeMin - 1e-9 && guard < 500) {
      if (useSupport && activeSupport < maxSupport) {
        state += supportLen;
        activeSupport++;
        supportUsedLifetime++;
        events.push(`+ Pipa opsional (${supportLen.toFixed(1)} m)`);

        if (activeSupport >= maxSupport) {
          const standardEquiv = round2((activeSupport * supportLen) / standardLen);
          standardCount += standardEquiv;
          events.push(`Tukar ${activeSupport} pipa opsional → ${fmt(standardEquiv)} pipa standar`);
          activeSupport = 0; // reset: opsi pipa 1,5 m tersedia lagi mulai siklus berikutnya
        }
      } else {
        state += standardLen;
        standardCount += 1;
        events.push(`+ Pipa standar (${standardLen.toFixed(1)} m)`);
      }
      guard++;
    }

    state -= interval;
    sequence.push({ meter: round2(m * interval), stickUp: round2(state), events });
  }

  return {
    finalStickUp: round2(state),
    lastMeter: round2(N * interval),
    sequence,
    activeSupport,
    standardCount: round2(standardCount),
    supportUsedLifetime,
    cb, targetDepth,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt(n) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------- UI wiring ---------- */
function setStatus(state, text) {
  els.statusLamp.classList.remove('ready', 'error');
  if (state) els.statusLamp.classList.add(state);
  els.statusText.textContent = text;
}

function showError(msg) {
  els.errorBox.hidden = false;
  els.errorBox.textContent = msg;
  setStatus('error', 'INPUT TIDAK VALID');
  clearOutputs();
}

function clearOutputs() {
  els.outStickUp.textContent = '—';
  els.outLastMeter.textContent = '—';
  els.outPipeCount.textContent = '—';
  els.outStandard.textContent = '—';
  els.outActiveSupport.textContent = '—';
  els.outCB.textContent = '—';
  els.outSupportUsedTotal.textContent = '—';
  els.progressBody.innerHTML = '<tr><td colspan="3" class="empty-row">Isi kedalaman untuk melihat progres.</td></tr>';
}

function runCalculation() {
  els.errorBox.hidden = true;

  const targetDepth = parseFloat(els.targetDepth.value);
  const useSupport = els.useSupport.checked;
  const cb = parseFloat(els.cbLength.value);
  const interval = parseFloat(els.interval.value);
  const safeMin = parseFloat(els.safeMin.value);
  const standardLen = parseFloat(els.standardLen.value);
  const supportLen = parseFloat(els.supportLen.value);
  const maxSupport = parseFloat(els.maxSupport.value);

  if (isNaN(targetDepth) || targetDepth <= 0) {
    showError('Masukkan kedalaman target (meter) terlebih dahulu.');
    return;
  }

  const result = simulateStickUp(targetDepth, cb, interval, safeMin, standardLen, supportLen, maxSupport, useSupport);

  if (result.error) {
    showError(result.error);
    return;
  }

  els.outStickUp.textContent = fmt(result.finalStickUp);
  els.outLastMeter.textContent = fmt(result.lastMeter);
  els.outStandard.textContent = `${fmt(result.standardCount)} batang`;
  els.outActiveSupport.textContent = `${result.activeSupport} batang`;
  els.outCB.textContent = `${fmt(cb)} m`;
  els.outSupportUsedTotal.textContent = `${result.supportUsedLifetime} batang`;
  els.outPipeCount.textContent = fmt(round2(result.standardCount + result.activeSupport + 1));

  renderTable(result.sequence);
  setStatus('ready', 'SIMULASI SELESAI');
}

function renderTable(sequence) {
  els.progressBody.innerHTML = '';
  sequence.forEach(row => {
    const tr = document.createElement('tr');
    if (row.events.length > 0) tr.classList.add('event-row');

    const tdMeter = document.createElement('td');
    tdMeter.textContent = `${fmt(row.meter)} m`;

    const tdStickUp = document.createElement('td');
    tdStickUp.textContent = `${fmt(row.stickUp)} m`;

    const tdEvent = document.createElement('td');
    if (row.events.length > 0) {
      row.events.forEach(ev => {
        const tag = document.createElement('span');
        tag.className = 'event-tag' + (ev.startsWith('Tukar') ? ' swap' : '');
        tag.textContent = ev;
        tdEvent.appendChild(tag);
      });
    } else {
      tdEvent.textContent = '—';
      tdEvent.style.color = 'var(--text-dim)';
    }

    tr.appendChild(tdMeter);
    tr.appendChild(tdStickUp);
    tr.appendChild(tdEvent);
    els.progressBody.appendChild(tr);
  });
}

els.calcBtn.addEventListener('click', runCalculation);
els.targetDepth.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCalculation(); });
