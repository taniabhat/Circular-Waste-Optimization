/* =========================================================
   UWRMS — Waste Intelligence Platform · app.js
   Real data powered by MongoDB backend
   ========================================================= */

'use strict';

// ── API Configuration ──
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://uwrms-backend.onrender.com'; // Update after Render deployment

// ── Auth Guard ──
const token = localStorage.getItem('uwrms_token');
const user = JSON.parse(localStorage.getItem('uwrms_user') || 'null');

// if (!token) {
//   window.location.href = 'login.html';
// }

// Display user info in topbar
(function setupUser() {
  const userEl = document.getElementById('user-display');
  const logoutBtn = document.querySelector('.logout-btn');
  if (userEl) {
    if (user && token) {
      userEl.textContent = user.name || user.email;
      if (logoutBtn) logoutBtn.style.display = 'flex';
    } else {
      userEl.textContent = 'Login / Sign Up';
      userEl.style.cursor = 'pointer';
      userEl.onclick = () => window.location.href = 'login.html';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }
})();

// Logout handler
window.handleLogout = function () {
  localStorage.removeItem('uwrms_token');
  localStorage.removeItem('uwrms_user');
  window.location.href = 'login.html';
};

// ── API Helper ──
async function apiFetch(endpoint) {
  try {
    const res = await fetch(API_URL + endpoint, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401) {
      // Token expired — redirect to login
      localStorage.removeItem('uwrms_token');
      localStorage.removeItem('uwrms_user');
      // window.location.href = 'login.html';
      return null;
    }

    if (!res.ok) throw new Error('API Error: ' + res.status);
    return await res.json();
  } catch (error) {
    console.error('API fetch error for ' + endpoint + ':', error);
    return null;
  }
}

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

/* ── FETCH AND RENDER REAL DATA ── */

// Color map for waste types
const wasteColors = {
  'Organic':       { color: 'var(--green3)', label: 'Organic / Kitchen' },
  'Plastic':       { color: 'var(--blue)', label: 'Recyclable Plastic' },
  'Construction':  { color: 'var(--amber)', label: 'Construction' },
  'E-Waste':       { color: 'var(--teal)', label: 'E-Waste' },
  'Hazardous':     { color: 'var(--red)', label: 'Hazardous' }
};

// ── 1. Load Overview KPIs ──
async function loadStats() {
  const data = await apiFetch('/api/data/stats');
  if (!data || !data.summary) return;

  const s = data.summary;

  const waste = document.getElementById('kpi-waste');
  const biogas = document.getElementById('kpi-biogas');
  const co2 = document.getElementById('kpi-co2');
  const cost = document.getElementById('kpi-cost');

  if (waste) waste.textContent = Number(s.totalWasteGenerated).toLocaleString('en-IN') + ' T';
  if (biogas) biogas.textContent = s.avgRecyclingRate + '%';
  if (co2) co2.textContent = s.cityCount + ' Cities';
  if (cost) cost.textContent = '₹' + Number(s.avgCost).toLocaleString('en-IN');

  // Update KPI labels
  const kpiLabels = document.querySelectorAll('.kpi-label');
  if (kpiLabels[0]) kpiLabels[0].textContent = 'Total Waste (Tons)';
  if (kpiLabels[1]) kpiLabels[1].textContent = 'Avg Recycling Rate';
  if (kpiLabels[2]) kpiLabels[2].textContent = 'Cities Covered';
  if (kpiLabels[3]) kpiLabels[3].textContent = 'Avg Cost (₹/Ton)';

  // Update deltas
  const deltas = document.querySelectorAll('.kpi-delta');
  if (deltas[0]) deltas[0].innerHTML = '↑ ' + s.totalRecords + ' records across India';
  if (deltas[1]) { deltas[1].innerHTML = '↑ Avg Efficiency: ' + s.avgEfficiency + '/10'; }
  if (deltas[2]) deltas[2].innerHTML = '↑ 2019–2023 dataset';
  if (deltas[3]) deltas[3].innerHTML = '↑ ' + s.avgAwarenessCampaigns + ' campaigns avg';

  // Update yearly bar chart data
  if (data.yearlyTrend) {
    drawYearlyBarChart(data.yearlyTrend);
  }
}

// ── 2. Load Waste Stream Mix ──
async function loadWasteByType() {
  const data = await apiFetch('/api/data/waste-by-type');
  if (!data || !data.wasteTypes) return;

  const container = document.getElementById('waste-streams');
  if (!container) return;

  container.innerHTML = '';

  data.wasteTypes.forEach(w => {
    const info = wasteColors[w.wasteType] || { color: '#888', label: w.wasteType };
    const div = document.createElement('div');
    div.className = 'stream-item';
    div.innerHTML = `
      <div class="stream-dot" style="background:${info.color}"></div>
      <span class="stream-name">${info.label}</span>
      <div class="stream-bar-wrap"><div class="stream-bar-fill" style="width:${w.percentage}%;background:${info.color}"></div></div>
      <span class="stream-pct mono">${w.percentage}%</span>
    `;
    container.appendChild(div);
  });
}

// ── 3. Draw Yearly Bar Chart (replaces fake hourly data) ──
function drawYearlyBarChart(yearlyTrend) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.clientWidth - 32;
  const H = 110;
  canvas.width = W;
  canvas.height = H;

  if (!yearlyTrend || yearlyTrend.length === 0) return;

  const data = yearlyTrend.map(y => y.totalWaste);
  const labels = yearlyTrend.map(y => y._id);
  const max = Math.max(...data);
  const barW = Math.min((W / data.length) - 16, 60);
  const gap = (W - barW * data.length) / (data.length + 1);

  // Clear
  ctx.clearRect(0, 0, W, H);

  const docStyle = getComputedStyle(document.documentElement);
  const colors = [
    docStyle.getPropertyValue('--green2').trim() || '#16a34a',
    docStyle.getPropertyValue('--green').trim() || '#22c55e',
    docStyle.getPropertyValue('--green3').trim() || '#4ade80',
    docStyle.getPropertyValue('--teal').trim() || '#2dd4bf',
    docStyle.getPropertyValue('--blue').trim() || '#60a5fa'
  ];

  data.forEach((val, i) => {
    const h = Math.round((val / max) * (H - 30));
    const x = gap + i * (barW + gap);
    const y = H - h - 16;

    ctx.globalAlpha = 0.7 + (val / max) * 0.3;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, h, [4, 4, 0, 0]);
    ctx.fill();

    // Year label
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a7a64';
    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, H - 2);

    // Value label
    ctx.fillStyle = '#9ab8a4';
    ctx.font = '9px "Space Mono", monospace';
    ctx.fillText((val / 1000).toFixed(0) + 'K', x + barW / 2, y - 4);
  });
  ctx.globalAlpha = 1;

  // Update chart title
  const chartTitle = canvas.closest('.card')?.querySelector('.card-title');
  if (chartTitle) chartTitle.textContent = 'Waste Generated by Year (Tons)';
}

// ── 4. Load City Data for Facility Network ──
async function loadCityData() {
  const data = await apiFetch('/api/data/waste-by-city');
  if (!data || !data.cities) return;

  const mapContainer = document.getElementById('facilityMap');
  if (!mapContainer) return;

  // Clear existing nodes (keep the grid background)
  mapContainer.querySelectorAll('.map-node').forEach(n => n.remove());

  // Get top 6 cities by waste
  const topCities = data.cities.slice(0, 6);
  const colors = ['var(--green3)', 'var(--blue)', 'var(--teal)', 'var(--amber)', 'var(--red)', 'var(--green2)'];
  const pingClasses = ['ping-green', 'ping-blue', 'ping-teal', 'ping-amber', 'ping-green', 'ping-blue'];

  // Position cities in the map
  const positions = [
    { top: '25%', left: '18%' },
    { top: '60%', left: '55%' },
    { top: '20%', left: '72%' },
    { top: '70%', left: '28%' },
    { top: '40%', left: '42%' },
    { top: '55%', left: '82%' }
  ];

  topCities.forEach((city, i) => {
    const node = document.createElement('div');
    node.className = 'map-node';
    node.style.top = positions[i].top;
    node.style.left = positions[i].left;
    node.innerHTML = `
      <div class="map-ping ${pingClasses[i]}"></div>
      <div class="map-dot" style="background:${colors[i]}"></div>
      <div class="map-label">${city.city}</div>
    `;
    mapContainer.appendChild(node);
  });

  // Update legend
  const legend = document.querySelector('.map-legend');
  if (legend) {
    legend.innerHTML = topCities.slice(0, 3).map((c, i) =>
      `<span><span style="color:${colors[i]}">●</span> ${c.city} (${(c.totalGenerated / 1000).toFixed(0)}K T)</span>`
    ).join('');
  }

  // Update facility cards
  updateFacilityCards(data.cities);
}

// ── 5. Update Facility Cards ──
function updateFacilityCards(cities) {
  const container = document.querySelector('#tab-facilities .facility-grid');
  if (!container || !cities || cities.length === 0) return;

  container.innerHTML = '';
  const colors = ['var(--green3)', 'var(--blue)', 'var(--teal)', 'var(--amber)', 'var(--red)', 'var(--green2)'];
  const statusLabels = ['Online', 'Processing', 'Online', 'Warning', 'Online', 'Processing'];
  const statusClasses = ['badge-green', 'badge-blue', 'badge-green', 'badge-amber', 'badge-green', 'badge-blue'];

  // Show top 6 cities as "facilities"
  cities.slice(0, 6).forEach((city, i) => {
    const card = document.createElement('div');
    card.className = 'card facility-card';
    const efficiency = Math.round(city.avgEfficiency * 10);
    card.innerHTML = `
      <div class="facility-header" style="border-left:3px solid ${colors[i % colors.length]}">
        <div>
          <div class="facility-name">${city.city}</div>
          <div class="facility-type">Pop. Density: ${Number(city.populationDensity).toLocaleString()} /km² · ${city.count} records</div>
        </div>
        <span class="badge ${statusClasses[i % statusClasses.length]}">${statusLabels[i % statusLabels.length]}</span>
      </div>
      <div class="facility-stats">
        <div class="fstat"><div class="fstat-val mono">${Number(city.totalGenerated).toLocaleString()} T</div><div class="fstat-lbl">Total waste</div></div>
        <div class="fstat"><div class="fstat-val mono" style="color:${colors[i % colors.length]}">${city.avgRecyclingRate}%</div><div class="fstat-lbl">Recycling rate</div></div>
        <div class="fstat"><div class="fstat-val mono" style="color:#22c55e">${city.avgEfficiency}/10</div><div class="fstat-lbl">Efficiency</div></div>
      </div>
      <div class="facility-bar"><div style="width:${efficiency}%;background:${colors[i % colors.length]}"></div></div>
      <div class="facility-bar-label"><span>Avg Cost: ₹${Number(city.avgCost).toLocaleString()}/Ton</span><span class="mono">Cap: ${Number(city.landfillCapacity).toLocaleString()} T</span></div>
    `;
    container.appendChild(card);
  });
}

// ── 6. Load Reports Data ──
async function loadReports() {
  const [statsData, effData, disposalData] = await Promise.all([
    apiFetch('/api/data/stats'),
    apiFetch('/api/data/efficiency-report'),
    apiFetch('/api/data/disposal-methods')
  ]);

  // ESG Summary
  if (statsData && statsData.summary) {
    const s = statsData.summary;
    const reportStats = document.querySelectorAll('#tab-reports .report-stat');
    if (reportStats.length >= 4) {
      reportStats[0].querySelector('.rs-val').textContent = Number(s.totalWasteGenerated).toLocaleString('en-IN') + ' Tons';
      reportStats[0].querySelector('.rs-lbl').textContent = 'Total waste processed (2019-2023)';
      reportStats[1].querySelector('.rs-val').textContent = s.avgRecyclingRate + '%';
      reportStats[1].querySelector('.rs-lbl').textContent = 'Average recycling rate';
      reportStats[2].querySelector('.rs-val').textContent = s.cityCount + ' Cities';
      reportStats[2].querySelector('.rs-lbl').textContent = 'Cities covered across India';
      reportStats[3].querySelector('.rs-val').textContent = '₹' + Number(s.avgCost).toLocaleString('en-IN');
      reportStats[3].querySelector('.rs-lbl').textContent = 'Average cost per ton';
    }
  }

  // Conversion Efficiency — use waste type recycling rates
  if (effData && effData.byType) {
    const effContainer = document.querySelectorAll('#tab-reports .card')[1];
    if (effContainer) {
      const effTitle = effContainer.querySelector('.card-title');
      if (effTitle) effTitle.textContent = 'Recycling Rate by Waste Type';

      const rows = effContainer.querySelectorAll('.eff-row');
      const typeColors = { 'Organic': 'var(--green3)', 'Plastic': 'var(--blue)', 'E-Waste': 'var(--teal)', 'Construction': 'var(--amber)', 'Hazardous': 'var(--red)' };

      effData.byType.forEach((t, i) => {
        if (rows[i]) {
          rows[i].querySelector('span').textContent = t.wasteType;
          rows[i].querySelector('.eff-bar').style.width = t.avgRecyclingRate + '%';
          rows[i].querySelector('.eff-bar').style.background = typeColors[t.wasteType] || '#888';
          rows[i].querySelectorAll('span')[rows[i].querySelectorAll('span').length - 1].textContent = t.avgRecyclingRate + '%';
        }
      });
    }
  }

  // Disposal methods in Model Performance section
  if (disposalData && disposalData.methods) {
    const perfContainer = document.querySelectorAll('#tab-reports .card')[2];
    if (perfContainer) {
      const perfTitle = perfContainer.querySelector('.card-title');
      if (perfTitle) perfTitle.textContent = 'Disposal Method Distribution';

      const rows = perfContainer.querySelectorAll('.eff-row');
      const methodColors = { 'Landfill': 'var(--amber)', 'Incineration': 'var(--red)', 'Recycling': 'var(--green3)' };

      disposalData.methods.forEach((m, i) => {
        if (rows[i]) {
          rows[i].querySelector('span').textContent = m.method;
          rows[i].querySelector('.eff-bar').style.width = m.percentage + '%';
          rows[i].querySelector('.eff-bar').style.background = methodColors[m.method] || '#888';
          rows[i].querySelectorAll('span')[rows[i].querySelectorAll('span').length - 1].textContent = m.percentage + '%';
        }
      });

      // Hide extra rows
      for (let i = disposalData.methods.length; i < rows.length; i++) {
        rows[i].style.display = 'none';
      }
    }
  }
}

/* ── INITIAL DATA LOAD ── */
async function loadAllData() {
  // Show loading state
  document.querySelectorAll('.kpi-value').forEach(el => el.style.opacity = '0.5');

  await Promise.all([
    loadStats(),
    loadWasteByType(),
    loadCityData(),
    loadReports()
  ]);

  // Remove loading state
  document.querySelectorAll('.kpi-value').forEach(el => el.style.opacity = '1');
}

loadAllData();

/* ── LIVE DATA SIMULATION (for Sensors & Biogas — no real sensor data in CSV) ── */
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

/* ── ML INTEGRATION ── */
const ML_API_URL = 'http://localhost:8000';

async function fetchML() {
  try {
    const weight_kg = parseFloat(document.getElementById('s-binA').textContent) || 50;
    const moisture_pct = parseFloat(document.getElementById('s-moist').textContent) || 75;
    const temperature_c = parseFloat(document.getElementById('s-temp').textContent) || 30;
    const ph_level = parseFloat(document.getElementById('s-ph').textContent) || 6.0;
    const methane_voc_ppm = parseFloat(document.getElementById('s-ch4').textContent.replace(/,/g, '')) || 1200;
    
    const sensorPayload = {
      weight_kg,
      moisture_pct,
      temperature_c,
      fill_level_pct: 70,
      ph_level,
      bod_mg_l: 150,
      methane_voc_ppm
    };

    // 1. Random Forest Classification
    fetch(`${ML_API_URL}/api/layer2/random-forest/classify/sensor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sensorPayload)
    }).then(r => r.json()).then(data => {
      const batchEl = document.getElementById('ai-batch');
      if (batchEl) batchEl.textContent = data.rf_waste_type_classification || 'Unknown';
      const rfEl = document.getElementById('ai-rf');
      if (rfEl) rfEl.textContent = (data.confidence * 100).toFixed(1) + '%';
    }).catch(e => console.log('RF error:', e));

    // 2. Anomaly Detection
    fetch(`${ML_API_URL}/api/layer1/anomaly-detection/sensor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sensorPayload)
    }).then(r => r.json()).then(data => {
      const anomEl = document.getElementById('ai-anomaly');
      if (!anomEl) return;
      if (data.is_anomaly) {
        anomEl.textContent = 'Anomaly (' + data.anomaly_score.toFixed(2) + ')';
        anomEl.className = 'badge badge-red';
      } else {
        anomEl.textContent = 'Normal (' + data.anomaly_score.toFixed(2) + ')';
        anomEl.className = 'badge badge-green';
      }
    }).catch(e => console.log('Anomaly error:', e));

    // 3. CNN Vision
    fetch(`${ML_API_URL}/api/layer1/computer-vision/cnn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: 'dummy' })
    }).then(r => r.json()).then(data => {
      const cnnEl = document.getElementById('ai-cnn');
      if (cnnEl) cnnEl.textContent = (data.confidence * 100).toFixed(1) + '% (' + data.visual_classification + ')';
    }).catch(e => console.log('CNN error:', e));

    // 4. RL Route Selection
    fetch(`${ML_API_URL}/api/layer2/rl-engine/optimize-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rf_classification: document.getElementById('ai-batch')?.textContent || 'Unknown',
        current_sensors: sensorPayload,
        facility_capacities: {}
      })
    }).then(r => r.json()).then(data => {
      const routeEl = document.getElementById('ai-route');
      if (routeEl) routeEl.textContent = '→ ' + data.optimal_route;
    }).catch(e => console.log('RL error:', e));

  } catch (error) {
    console.error('Error fetching ML service:', error);
  }
}

function startLiveUpdates() {
  if (liveInterval) return;
  updateSensors();
  fetchML();
  liveInterval = setInterval(() => {
    updateSensors();
    fetchML();
  }, 3000);
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

/* ── ESG PDF REPORT DOWNLOAD ── */
window.downloadESGReport = async function() {
  const btn = document.querySelector('.download-btn');
  if (btn) btn.textContent = 'Generating PDF...';
  try {
    const reportData = {
      total_waste: document.getElementById('kpi-waste')?.textContent || 'N/A',
      recycling_rate: document.getElementById('kpi-biogas')?.textContent || 'N/A',
      cities_covered: document.getElementById('kpi-co2')?.textContent || 'N/A',
      avg_cost: document.getElementById('kpi-cost')?.textContent || 'N/A'
    };
    const res = await fetch(`${ML_API_URL}/api/reports/esg-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });
    if (!res.ok) throw new Error('PDF generation failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UWRMS_ESG_Report.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download error:', err);
    alert('Failed to generate PDF. Make sure the ML service is running on port 8000.');
  } finally {
    if (btn) btn.textContent = '↓ Download Full ESG Report (PDF)';
  }
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

/* ── CHATBOT LOGIC ── */
window.toggleChat = function() {
  const win = document.getElementById('chatWindow');
  win.classList.toggle('active');
};

window.handleChatKey = function(e) {
  if (e.key === 'Enter') sendChatMessage();
};


let chatHistory = [
  { role: 'system', content: 'You are a helpful AI assistant for the UWRMS (Waste Intelligence Platform) dashboard. Answer concisely and use metrics when relevant.' }
];

window.sendChatMessage = async function() {
  const input = document.getElementById('chatInput');
  const msgs = document.getElementById('chatMessages');
  const typing = document.getElementById('chatTyping');
  const text = input.value.trim();
  if (!text) return;

  const uMsg = document.createElement('div');
  uMsg.className = 'chat-msg user';
  uMsg.textContent = text;
  msgs.appendChild(uMsg);
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  chatHistory.push({ role: 'user', content: text });

  typing.style.display = 'block';

  try {
    const res = await fetch(API_URL + '/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: chatHistory
      })
    });

    const data = await res.json();
    let botReply = 'Sorry, I encountered an error.';
    
    if (res.ok && data.choices && data.choices[0]) {
      botReply = data.choices[0].message.content;
      chatHistory.push({ role: 'assistant', content: botReply });
    } else {
      console.error("API Error:", data);
      if (data.error && data.error.message) {
        botReply = `API Error: ${data.error.message}`;
      } else {
        botReply = 'Sorry, the AI service returned an error. Check console for details.';
      }
    }

    const bMsg = document.createElement('div');
    bMsg.className = 'chat-msg bot';
    bMsg.textContent = botReply;
    msgs.appendChild(bMsg);
  } catch (err) {
    const bMsg = document.createElement('div');
    bMsg.className = 'chat-msg bot';
    bMsg.textContent = 'Network error. Please try again later.';
    msgs.appendChild(bMsg);
  } finally {
    typing.style.display = 'none';
    msgs.scrollTop = msgs.scrollHeight;
  }
};
