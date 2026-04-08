/* =========================================================
   UWRMS — Waste Intelligence Platform · app.js
   ========================================================= */

'use strict';

/* ── TAB NAVIGATION ── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tabName = item.dataset.tab;
    if (!tabName) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const target = document.getElementById('tab-' + tabName);
    if (target) target.classList.add('active');

    const titles = {
      overview:   'Overview',
      sensors:    'Sensors',
      biogas:     'Biogas Loop',
      ai:         'AI Models',
      facilities: 'Facilities',
      alerts:     'Alerts',
      reports:    'Reports'
    };
    const el = document.getElementById('page-title');
    if (el) el.textContent = titles[tabName] || tabName;
  });
});

/* ── LIVE CLOCK ── */
function updateClock() {
  const el = document.getElementById('live-time');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
updateClock();
setInterval(updateClock, 1000);

/* ── BAR CHART (Canvas) ── */
function drawBarChart() {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Responsive sizing
  const W = canvas.parentElement.clientWidth - 32;
  const H = 110;
  canvas.width  = W;
  canvas.height = H;

  const data = [2,5,8,6,4,3,2,6,14,22,28,32,31,30,20,18,22,35,42,38,30,25,20,15];
  const max  = Math.max(...data);
  const barW = (W / data.length) - 2;
  const now  = new Date().getHours() + Math.round(new Date().getMinutes() / 60 * 4) / 4;

  data.forEach((val, i) => {
    const h   = Math.round((val / max) * (H - 10));
    const x   = i * (barW + 2);
    const y   = H - h;
    const t   = (i / data.length) * 24;
    const col = t >= now - 1 ? '#22c55e' : t >= 12 ? '#16a34a' : '#0f6e56';
    const alpha = 0.5 + (val / max) * 0.5;

    ctx.globalAlpha = alpha;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, h, [2, 2, 0, 0]);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

drawBarChart();
window.addEventListener('resize', drawBarChart);

/* ── LIVE DATA SIMULATION ── */
let autoMode = true;
let liveInterval = null;

const autoToggle = document.getElementById('autoToggle');
if (autoToggle) {
  autoToggle.addEventListener('change', () => {
    autoMode = autoToggle.checked;
    autoMode ? startLiveUpdates() : stopLiveUpdates();
  });
}

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.round(rand(min, max)); }

function updateKPIs() {
  const waste  = document.getElementById('kpi-waste');
  const biogas = document.getElementById('kpi-biogas');
  const co2    = document.getElementById('kpi-co2');
  const cost   = document.getElementById('kpi-cost');

  if (waste)  waste.textContent  = randInt(138, 148) + ' kg';
  if (biogas) biogas.textContent = rand(37, 40).toFixed(1) + ' m³';
  if (co2)    co2.textContent    = randInt(64, 70) + ' kg';
  if (cost)   cost.textContent   = '₹' + randInt(820, 860);
}

function updateSensors() {
  const map = {
    's-ch4':  () => randInt(1200, 1280) + ' ppm',
    's-co2':  () => randInt(3800, 3900) + ' ppm',
    's-nh3':  () => rand(16, 21).toFixed(1) + ' ppm',
    's-h2s':  () => rand(3.8, 5.0).toFixed(1) + ' ppm',
    's-voc':  () => randInt(68, 78) + ' / 100',
    's-binA': () => rand(46, 52).toFixed(1) + ' kg',
    's-binB': () => rand(10, 14).toFixed(1) + ' kg',
    's-moist':() => randInt(74, 79) + '%',
    's-ph':   () => rand(5.5, 6.2).toFixed(1),
    's-temp': () => randInt(27, 32) + '°C',
  };
  Object.entries(map).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fn();
  });
}

function startLiveUpdates() {
  if (liveInterval) return;
  liveInterval = setInterval(() => {
    updateKPIs();
    updateSensors();
    drawBarChart();
  }, 2000);
}

function stopLiveUpdates() {
  clearInterval(liveInterval);
  liveInterval = null;
}

startLiveUpdates();

/* ── CLEAR ALERTS ── */
window.clearAlerts = function() {
  const container = document.getElementById('alerts-container');
  if (container) container.innerHTML = '<p style="text-align:center;color:var(--text3);padding:32px;font-size:13px">No active alerts</p>';
  const badge = document.getElementById('alert-badge');
  if (badge) badge.style.display = 'none';
};

/* ── CANVAS POLYFILL FOR roundRect ── */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}
