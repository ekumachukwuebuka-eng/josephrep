/**
 * NetPulse Analytics Engine - Dashboard Interface Controller
 * Modeled on BPSK modulation metrics and Log-Distance Path Loss configurations
 */

// --- Global Application States ---
const CONFIG = {
  txPowerDbm: 20.0,
  frequencyMhz: 2400.0,
  noiseFloorDbm: -95.0,
  speedOfLight: 3e8
};

const wavelength = CONFIG.speedOfLight / (CONFIG.frequencyMhz * 1e6);
const pl0 = 20 * Math.log10(4 * Math.PI / wavelength);

const MAX_DATA_POINTS = 20;
let timeLabels = [];
let throughputData = [];
let berHistoricalData = [];

let throughputChart, berChart;
const domDistance = document.getElementById('distance');
const domDistanceVal = document.getElementById('distance-val');
const domEnv = document.getElementById('environment');
const domTerminal = document.getElementById('log-terminal');

function runPhysicsMath(distance, envType) {
  const nMap = { rural: 2.0, urban: 3.5, dense_indoor: 4.5 };
  const n = nMap[envType] || 3.0;

  const gaussianShadowing = (Math.random() - 0.5) * 2.0;
  const pathLoss = pl0 + (10 * n * Math.log10(distance)) + gaussianShadowing;

  const rxPower = CONFIG.txPowerDbm - pathLoss;

  const snrDb = rxPower - CONFIG.noiseFloorDbm;
  const snrLinear = Math.pow(10, snrDb / 10.0);

  let ber = 0.5;
  if (snrLinear > 0) {
    const x = Math.sqrt(2 * snrLinear);
    const t = 1.0 / (1.0 + 0.5 * Math.abs(x));
    const ans = t * Math.exp(
      -x * x - 1.26551223 +
      t * (
        1.00002368 +
        t * (
          0.37380863 +
          t * (
            -0.26668231 +
            t * (
              0.59897175 +
              t * (
                -0.74128934 +
                t * (
                  3.07295258 +
                  t * (
                    -3.71511270 +
                    t * (1.44454425)
                  )
                )
              )
            )
          )
        )
      )
    );
    const erfc = x >= 0 ? ans : 2.0 - ans;
    ber = 0.5 * erfc;
  }

  ber = Math.max(Math.min(ber, 0.5), 1e-6);
  return { pathLoss, rxPower, ber };
}

function updateUI(physics, isDropped, isAnomaly) {
  document.getElementById('metric-pathloss').innerText = `${physics.pathLoss.toFixed(2)} dB`;
  document.getElementById('metric-rxpower').innerText = `${physics.rxPower.toFixed(2)} dBm`;
  document.getElementById('metric-ber').innerText = physics.ber.toExponential(4);

  const statusCard = document.getElementById('metric-status');
  if (isAnomaly) {
    statusCard.innerText = "TRAFFIC SPIKE";
    statusCard.style.color = "#f59e0b";
  } else if (isDropped) {
    statusCard.innerText = "PACKET DROP";
    statusCard.style.color = "#f87171";
  } else {
    statusCard.innerText = "STABLE LINK";
    statusCard.style.color = "#4ade80";
  }
}

function logToTerminal(size, lat, dropped, anomaly) {
  const timestamp = new Date().toLocaleTimeString();
  let cssClass = "";
  let statusText = "SUCCESS";

  if (anomaly) {
    cssClass = "log-anomaly";
    statusText = "WARN: JUMBO FRAME INTRUSION DETECTED";
  } else if (dropped) {
    cssClass = "log-dropped";
    statusText = "DROP: FCS BIT ERROR CORRUPTION";
  }

  const line = document.createElement('div');
  line.className = `log-line ${cssClass}`;
  line.innerText = `[${timestamp}] Frame Size: ${size}B | Latency: ${lat.toFixed(1)}ms | Status: ${statusText}`;

  domTerminal.appendChild(line);
  domTerminal.scrollTop = domTerminal.scrollHeight;

  if (domTerminal.childNodes.length > 30) {
    domTerminal.removeChild(domTerminal.firstChild);
  }
}

function updateCharts(throughput, ber) {
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  timeLabels.push(timeNow);
  throughputData.push(throughput);
  berHistoricalData.push(ber);

  if (timeLabels.length > MAX_DATA_POINTS) {
    timeLabels.shift();
    throughputData.shift();
    berHistoricalData.shift();
  }

  throughputChart.update();
  berChart.update();
}

function initCharts() {
  const ctxThroughput = document.getElementById('throughputChart').getContext('2d');
  throughputChart = new Chart(ctxThroughput, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: 'Effective Data Throughput (Mbps)',
        data: throughputData,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, grid: { color: '#334155' } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
  });

  const ctxBer = document.getElementById('berChart').getContext('2d');
  berChart = new Chart(ctxBer, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        label: 'Channel Bit Error Rate (BER)',
        data: berHistoricalData,
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'logarithmic',
          min: 1e-6,
          max: 0.5,
          grid: { color: '#334155' }
        },
        x: { grid: { display: false } }
      },
      plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
  });
}

function runTelemetryPipeline() {
  const distance = parseFloat(domDistance.value);
  const env = domEnv.value;

  const physics = runPhysicsMath(distance, env);

  const isAnomaly = Math.random() < 0.04;
  const packetSize = isAnomaly ? Math.floor(Math.random() * 50000) + 15000 : Math.floor(Math.random() * 1400) + 64;
  const latency = isAnomaly ? Math.random() * 200 + 200 : Math.random() * 20 + 5 + (physics.ber * 50);

  const bitCount = packetSize * 8;
  const packetLossProb = 1 - Math.pow((1 - physics.ber), bitCount);
  const isDropped = Math.random() < packetLossProb;

  let throughput = isDropped ? 0 : ((packetSize * 8) / (latency / 1000)) / 1e6;
  if (throughput > 100) throughput = 100;

  updateUI(physics, isDropped, isAnomaly, throughput);
  updateCharts(throughput, physics.ber);
  logToTerminal(packetSize, latency, isDropped, isAnomaly);
}

domDistance.addEventListener('input', (e) => {
  domDistanceVal.innerText = `${e.target.value} m`;
  runTelemetryPipeline();
});

domEnv.addEventListener('change', () => {
  runTelemetryPipeline();
});

window.onload = () => {
  initCharts();
  runTelemetryPipeline();
  setInterval(runTelemetryPipeline, 800);
};
