# UWRMS — Unsupervised Waste Resource Management System
## Dashboard Web Application

A full-featured, production-grade intelligence dashboard for the UWRMS platform.

---

## Project Structure

```
uwrms-dashboard/
├── index.html          ← Main dashboard (single-page app)
├── css/
│   └── style.css       ← All styling (dark theme, responsive)
├── js/
│   └── app.js          ← Tab navigation, live data, canvas chart
├── assets/             ← Place icons / images here
└── README.md           ← This file
```

---

## Getting Started

No build tools required. Just open `index.html` in any modern browser:

```bash
# Option 1: Direct open
open index.html

# Option 2: Local dev server (recommended)
npx serve .
# or
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## Features

### Dashboard Tabs
| Tab | Description |
|-----|-------------|
| **Overview** | KPI cards, waste mix, module status, 24h bar chart, facility network map |
| **Sensors** | Live IoT sensor readings (gas, physical, AI classification), LSTM forecast |
| **Biogas Loop** | Circular gauges, animated closed-loop pipeline (waste → biogas → cooking) |
| **AI Models** | Status of all 6 AI algorithms (CNN, LSTM, RL, KG, Anomaly, FedAvg) |
| **Facilities** | Per-facility cards for restaurants, factory, household cluster |
| **Alerts** | Prioritised system alerts with dismiss functionality |
| **Reports** | ESG summary, conversion efficiency bars, model performance |

### Key UI Features
- **Auto-Mode toggle** — simulates live sensor data updates every 2 seconds
- **Responsive layout** — adapts for tablet/mobile (sidebar collapses to icons)
- **Canvas bar chart** — 24h waste volume rendered natively, no library needed
- **SVG gauges** — digester fill, CH₄ tank, gas offset, digestate
- **Animated flow pipeline** — shows biogas closed-loop in real time
- **Ping animations** — facility nodes pulse on the network map

---

## Connecting Real Data

Replace the simulation in `js/app.js` with your actual API calls:

```javascript
// Example: replace randInt() calls with real API fetch
async function fetchSensorData() {
  const res = await fetch('https://your-api.com/api/v1/sensors/live');
  const data = await res.json();
  document.getElementById('kpi-waste').textContent = data.waste_kg + ' kg';
  document.getElementById('kpi-biogas').textContent = data.biogas_m3.toFixed(1) + ' m³';
  // ... etc
}

// Replace startLiveUpdates() interval with:
setInterval(fetchSensorData, 5000);
```

### WebSocket (recommended for real-time)
```javascript
const ws = new WebSocket('wss://your-api.com/ws/sensors');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateKPIs(data);
  updateSensors(data);
};
```

---

## Backend Stack (Recommended)

| Layer | Technology |
|-------|-----------|
| API Framework | Python FastAPI |
| Sensor DB | PostgreSQL + TimescaleDB |
| Cache / Pub-Sub | Redis |
| ML Serving | TorchServe (CNN, LSTM, RL) |
| Knowledge Graph | Neo4j |
| IoT Protocol | MQTT (Mosquitto) |
| Federated Learning | Flower (flwr) |
| Containerisation | Docker Compose / Kubernetes |

---

## AI Algorithms Implemented

1. **CNN Classifier** — EfficientNet-B4, 22 waste classes, WasteNet-47K
2. **Random Forest** — 500 estimators, sensor feature fusion
3. **Bidirectional LSTM** — 2-layer, 128 units, 24/48/72h forecasting
4. **PPO RL Router** — ClosedLoopBonus reward, 5 conversion modules
5. **Isolation Forest + LSTM AE** — Anomaly detection, Bayesian fusion
6. **FedAvg** — Federated Learning across 17+ sites

---

## Patent Reference

This dashboard is the operational interface for the patent:
> *"UWRMS: An Autonomous, AI-Driven Unsupervised Waste Resource Management System for Multi-Domain Waste Detection, Classification, and Closed-Loop Resource Recovery"*

Primary novel claims embodied in the UI:
- Closed-loop biogas redistribution visualisation (Biogas Loop tab)
- RL ClosedLoopBonus reward display (AI Models tab)
- Unsupervised federated model tracking (AI Models → Federated Learning card)

---

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## License

Copyright © 2025 UWRMS Project. All rights reserved.
Patent Pending.
