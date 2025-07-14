const canvas = document.getElementById("canvas"),
  ctx = canvas.getContext("2d");
const sigmaSlider = document.getElementById("sigma"),
  sigmaValue = document.getElementById("sigmaValue");
const startBtn = document.getElementById("startBtn"),
  pauseBtn = document.getElementById("pauseBtn"),
  resetBtn = document.getElementById("resetBtn");
const ruleSelect = document.getElementById("rule"),
  noiseModelSelect = document.getElementById("noiseModel");
const dropsInput = document.getElementById("drops"),
  intervalInput = document.getElementById("interval");
const showFunnelCheckbox = document.getElementById("showFunnel");
const statsDiv = document.getElementById("stats");
let showFunnel = false;
showFunnelCheckbox.addEventListener(
  "change",
  (e) => (showFunnel = e.target.checked)
);
sigmaSlider.addEventListener(
  "input",
  () => (sigmaValue.textContent = sigmaSlider.value)
);
startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", pause);
resetBtn.addEventListener("click", reset);

const target = { x: canvas.width / 2, y: canvas.height / 2 };
let funnel = { ...target },
  hits = [],
  currentDrop,
  totalDrops,
  intervalId,
  currentRule;
const colors = { 1: "#1f77b4", 2: "#ff7f0e", 3: "#2ca02c", 4: "#d62728" };
const ruleNames = { 1: "Rule 1", 2: "Rule 2", 3: "Rule 3", 4: "Rule 4" };
const allDistances = { 1: [], 2: [], 3: [], 4: [] };
let drift = { x: 0, y: 0 };

function gaussian(mean = 0, sd = 1) {
  let u = 1 - Math.random(),
    v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
}
function truncatedGaussian(mean, sd, maxStd = 3) {
  let val;
  do {
    val = gaussian(mean, sd);
  } while (Math.abs(val - mean) > maxStd * sd);
  return val;
}
function driftedNoise(baseSD) {
  drift.x += truncatedGaussian(0, 0.1, 2);
  drift.y += truncatedGaussian(0, 0.1, 2);
  return {
    x: drift.x + truncatedGaussian(0, baseSD, 3),
    y: drift.y + truncatedGaussian(0, baseSD, 3),
  };
}

function drawTarget() {
  ctx.strokeStyle = "red";
  ctx.beginPath();
  ctx.moveTo(target.x - 10, target.y);
  ctx.lineTo(target.x + 10, target.y);
  ctx.moveTo(target.x, target.y - 10);
  ctx.lineTo(target.x, target.y + 10);
  ctx.stroke();
}
function drawFunnel() {
  if (!showFunnel) return;
  ctx.strokeStyle = colors[currentRule];
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(funnel.x, funnel.y, 10, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
}
function drawHit(h) {
  ctx.fillStyle = colors[currentRule];
  ctx.beginPath();
  ctx.arc(h.x, h.y, 4, 0, 2 * Math.PI);
  ctx.fill();
}
function moveFunnel(h) {
  switch (currentRule) {
    case "2":
      funnel.x += target.x - h.x;
      funnel.y += target.y - h.y;
      break;
    case "3":
      funnel.x = 2 * target.x - h.x;
      funnel.y = 2 * target.y - h.y;
      break;
    case "4":
      funnel.x = h.x;
      funnel.y = h.y;
      break;
  }
}
function drawEnclosingCircle() {
  const m = Math.max(
    ...hits.map((h) => Math.hypot(h.x - target.x, h.y - target.y))
  );
  ctx.strokeStyle = colors[currentRule];
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(target.x, target.y, m, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colors[currentRule];
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  let lx, ly;
  if (currentRule === "1") {
    lx = target.x;
    ly = target.y - m - 12;
    ctx.textBaseline = "bottom";
  } else if (currentRule === "2") {
    lx = target.x + m + 12;
    ly = target.y;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
  } else if (currentRule === "3") {
    lx = target.x;
    ly = target.y + m + 12;
    ctx.textBaseline = "top";
  } else {
    lx = target.x - m - 12;
    ly = target.y;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
  }

  const labelOffset = 16;
  let ruleLabelY = ly - labelOffset;
  if (currentRule === "3") {
    ruleLabelY = ly + labelOffset;
  }

  ctx.fillText(`Rule ${currentRule}`, lx, ruleLabelY);
  ctx.fillText(`⌀ ${(2 * m).toFixed(1)}`, lx, ly);
  drawTarget();
}
function computeStats() {
  const d = hits.map((h) => Math.hypot(h.x - target.x, h.y - target.y));
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const varc = d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length;
  const sd = Math.sqrt(varc),
    max = Math.max(...d);
  const pct1 = ((d.filter((v) => v <= sd).length / d.length) * 100).toFixed(1);
  const pct2 = ((d.filter((v) => v <= 2 * sd).length / d.length) * 100).toFixed(
    1
  );
  return { mean, sd, max, pct1, pct2 };
}
function updatePlot() {
  const traces = [];
  for (let r in allDistances) {
    if (allDistances[r].length) {
      traces.push({
        x: allDistances[r],
        type: "histogram",
        opacity: 0.5,
        name: ruleNames[r],
        marker: { color: colors[r] },
        autobinx: false,
        xbins: { start: 0, end: Math.max(...allDistances[r]), size: 1 },
      });
    }
  }
  Plotly.newPlot("plotlyHistogram", traces, {
    barmode: "overlay",
    width: 600,
    height: 400,
    title: "Distribution of Marble Distances from Target",
  });
}
function recordStats() {
  const s = computeStats();
  const e = document.createElement("div");
  e.className = "stat-entry";
  e.innerHTML = `<div class='entry-title' style='color:${
    colors[currentRule]
  }'>${ruleNames[currentRule]}</div><div>Mean: ${s.mean.toFixed(
    1
  )}</div><div>SD: ${s.sd.toFixed(1)}</div><div>Max: ${s.max.toFixed(
    1
  )}</div><div>% ≤1σ: ${s.pct1}%</div><div>% ≤2σ: ${s.pct2}%</div>`;
  statsDiv.appendChild(e);
}
function dropMarble() {
  if (currentDrop >= totalDrops) {
    clearInterval(intervalId);
    drawEnclosingCircle();
    allDistances[currentRule] = hits.map((h) =>
      Math.hypot(h.x - target.x, h.y - target.y)
    );
    updatePlot();
    recordStats();
    return;
  }
  drawFunnel();
  const sigma = parseFloat(sigmaSlider.value),
    noiseModel = noiseModelSelect.value;
  let dx, dy;
  if (noiseModel === "truncated_drift") {
    const d = driftedNoise(sigma);
    dx = d.x;
    dy = d.y;
  } else {
    dx = gaussian(0, sigma);
    dy = gaussian(0, sigma);
  }
  const hit = { x: funnel.x + dx, y: funnel.y + dy };
  hits.push(hit);
  drawHit(hit);
  moveFunnel(hit);
  currentDrop++;
}
function start() {
  if (intervalId) clearInterval(intervalId);
  currentRule = ruleSelect.value;
  totalDrops = parseInt(dropsInput.value, 10);
  currentDrop = 0;
  hits = [];
  funnel = { ...target };
  allDistances[currentRule] = [];
  drawTarget();
  intervalId = setInterval(dropMarble, parseInt(intervalInput.value, 10));
}
function pause() {
  if (intervalId) clearInterval(intervalId);
}
function reset() {
  if (intervalId) clearInterval(intervalId);
  currentDrop = 0;
  hits = [];
  funnel = { ...target };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let r in allDistances) allDistances[r] = [];
  Plotly.purge("plotlyHistogram");
  document.getElementById("plotlyHistogram").innerHTML = "";
  statsDiv.innerHTML = "<h2>Run Statistics</h2>";
  drawTarget();
}
// init
reset();
