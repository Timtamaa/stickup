/* ==========================================================
   STICK-UP GAUGE — simulasi per-meter

   Setiap kemajuan 1 interval pengeboran mengurangi stick up
   sebesar panjang interval tersebut. Jika pengurangan itu akan
   membuat stick up jatuh di bawah batas aman, sebuah pipa
   ditambahkan dulu ke rangkaian sebelum interval itu dijalankan.

   Dua penambahan pertama memakai pipa "support" (default 1.5 m).
   Begitu pemakaian pipa support mencapai batas maksimum (default
   2 kali), kedua pipa support itu ditukar (secara pembukuan,
   panjang setara) dengan 1 pipa standar (default 3 m), dan semua
   penambahan berikutnya memakai pipa standar.

   Formula tiap kejadian penambahan:
     Stick Up = Total Pipa Masuk Tanah + Barrel − Total Kedalaman
   ========================================================== */

const els = {
  targetDepth: document.getElementById('targetDepth'),
  calcBtn: document.getElementById('calcBtn'),
  advToggle: document.getElementById('advToggle'),
  advancedPanel: document.getElementById('advancedPanel'),
  cbLength: document.getElementById('cbLength'),
  interval: document.getElementById('interval'),
  safeMin: document.getElementById('safeMin'),
  supportLen: document.getElementById('supportLen'),
  standardLen: document.getElementById('standardLen'),
  maxSupport: document.getElementById('maxSupport'),
  errorBox: document.getElementById('errorBox'),
  statusLamp: document.getElementById('statusLamp'),
  statusText: document.getElementById('statusText'),
  outStickUp: document.getElementById('outStickUp'),
  outLastMeter: document.getElementById('outLastMeter'),
  outPipeCount: document.getElementById('outPipeCount'),
  outActiveSupport: document.getElementById('outActiveSupport'),
  outStandard: document.getElementById('outStandard'),
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
function simulateStickUp(targetDepth, cb, interval, safeMin, supportLen, standardLen, maxSupport) {
  if (targetDepth <= 0) return { error: 'Kedalaman target harus lebih besar dari 0.' };
  if (cb <= 0 || interval <= 0 || supportLen <= 0 || standardLen <= 0) {
    return { error: 'Semua panjang komponen dan interval harus lebih besar dari 0.' };
  }
  if (maxSupport < 0 || isNaN(maxSupport)) maxSupport = 0;
  if (safeMin < 0 || isNaN(safeMin)) safeMin = 0;

  const N = Math.round(targetDepth / interval);
  if (N <= 0) return { error: 'Kedalaman target terlalu kecil untuk satu interval pengeboran.' };

  let state = cb;
  let supportUsed = 0;    // total pemakaian pipa support seumur simulasi (dibatasi maxSupport)
  let activeSupport = 0;  // pipa support yang sedang tertanam, belum ditukar
  let standardCount = 0;  // total pipa standar (langsung + hasil tukar)
  const sequence = [];

  for (let m = 1; m <= N; m++) {
    let events = [];
    let guard = 0;
    while (state - interval < safeMin - 1e-9 && guard < 200) {
      if (supportUsed < maxSupport) {
        state += supportLen;
        supportUsed++;
        activeSupport++;
        events.push(`+ Pipa support (${supportLen.toFixed(1)} m)`);
        if (activeSupport >= maxSupport && maxSupport > 0) {
          const standardEquiv = (activeSupport * supportLen) / standardLen;
          standardCount += standardEquiv;
          activeSupport = 0;
          events.push(`Tukar ${maxSupport} pipa support → ${fmt(standardEquiv)} pipa standar`);
        }
      } else {
        state += standardLen;
        standardCount += 1;
        events.push(`+ Pipa standar (${standardLen.toFixed(1)} m)`);
      }
      guard++;
    }
    state -= interval;
    sequence.push({ meter: m, stickUp: round2(state), events });
  }

  return {
    finalStickUp: round2(state),
    lastMeter: N,
    sequence,
    activeSupport,
    standardCount: round2(standardCount),
    supportUsed,
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
  els.outActiveSupport.textContent = '—';
  els.outStandard.textContent = '—';
  els.outCB.textContent = '—';
  els.outSupportUsedTotal.textContent = '—';
  els.progressBody.innerHTML = '<tr><td colspan="3" class="empty-row">Isi kedalaman untuk melihat progres.</td></tr>';
}

function runCalculation() {
  els.errorBox.hidden = true;

  const targetDepth = parseFloat(els.targetDepth.value);
  const cb = parseFloat(els.cbLength.value);
  const interval = parseFloat(els.interval.value);
  const safeMin = parseFloat(els.safeMin.value);
  const supportLen = parseFloat(els.supportLen.value);
  const standardLen = parseFloat(els.standardLen.value);
  const maxSupport = parseFloat(els.maxSupport.value);

  if (isNaN(targetDepth) || targetDepth <= 0) {
    showError('Masukkan kedalaman target (meter) terlebih dahulu.');
    return;
  }

  const result = simulateStickUp(targetDepth, cb, interval, safeMin, supportLen, standardLen, maxSupport);

  if (result.error) {
    showError(result.error);
    return;
  }

  els.outStickUp.textContent = fmt(result.finalStickUp);
  els.outLastMeter.textContent = result.lastMeter;
  els.outActiveSupport.textContent = `${result.activeSupport} batang`;
  els.outStandard.textContent = `${fmt(result.standardCount)} batang`;
  els.outCB.textContent = `${fmt(cb)} m`;
  els.outSupportUsedTotal.textContent = `${result.supportUsed} batang`;
  els.outPipeCount.textContent = round2(result.activeSupport + result.standardCount + 1);

  renderTable(result.sequence);

  setStatus('ready', 'SIMULASI SELESAI');
}

function renderTable(sequence) {
  els.progressBody.innerHTML = '';
  sequence.forEach(row => {
    const tr = document.createElement('tr');
    if (row.events.length > 0) tr.classList.add('event-row');

    const tdMeter = document.createElement('td');
    tdMeter.textContent = row.meter;

    const tdStickUp = document.createElement('td');
    tdStickUp.textContent = `${fmt(row.stickUp)} m`;

    const tdEvent = document.createElement('td');
    if (row.events.length > 0) {
      row.events.forEach(ev => {
        const tag = document.createElement('span');
        tag.className = 'event-tag' + (ev.startsWith('Tukar') ? ' swap' : '');
        tag.textContent = ev;
        tdEvent.appendChild(tag);
        tdEvent.appendChild(document.createTextNode(' '));
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
els.targetDepth.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runCalculation();
});
