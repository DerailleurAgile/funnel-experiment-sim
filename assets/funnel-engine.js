document.addEventListener("DOMContentLoaded", () => {
  // Element references
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const form = document.getElementById("configForm");
  const statsDiv = document.getElementById("stats");

  // Scale factor based on original 600px reference
  const scaleFactor = Math.min(canvas.width, canvas.height) / 800;

  // Simulation state
  let showFunnel = false;
  let config = {};
  let funnel, hits, currentDrop, totalDrops, intervalId, currentRule;
  let drift = { x: 0, y: 0 };
  const target = { x: canvas.width / 2, y: canvas.height / 2 };
  const colors = { 1: "#1f77b4", 2: "#ff7f0e", 3: "#2ca02c", 4: "#d62728" };
  const ruleNames = { 1: "Rule 1", 2: "Rule 2", 3: "Rule 3", 4: "Rule 4" };
  const allDistances = { 1: [], 2: [], 3: [], 4: [] };
  let masterHits = [];

  // Delegate form events
  form.addEventListener("input", e => {
    if (e.target.id === "sigma") {
      document.getElementById("sigmaValue").textContent = e.target.value;
    } else if (e.target.id === "showFunnel") {
      showFunnel = e.target.checked;
    }
  });
  form.addEventListener("click", e => {
    if (e.target.id === "startBtn") start();
    else if (e.target.id === "pauseBtn") pause();
    else if (e.target.id === "resetBtn") reset();
    else if (e.target.id === "exportBtn") exportCSV();
  });

  // Noise generators
  function gaussian(mean = 0, sd = 1) {
    let u = 1 - Math.random(), v = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
  }
  function truncatedGaussian(mean, sd, maxStd = 3) {
    let val;
    do { val = gaussian(mean, sd); } while (Math.abs(val - mean) > maxStd * sd);
    return val;
  }
  function driftedNoise(baseSD) {
    drift.x += truncatedGaussian(0, 0.1, 2);
    drift.y += truncatedGaussian(0, 0.1, 2);
    return { x: drift.x + truncatedGaussian(0, baseSD, 3), y: drift.y + truncatedGaussian(0, baseSD, 3) };
  }

  // Drawing helpers
  function drawTargetCross() {
    const len = 10 * scaleFactor;
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1 * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(target.x - len, target.y);
    ctx.lineTo(target.x + len, target.y);
    ctx.moveTo(target.x, target.y - len);
    ctx.lineTo(target.x, target.y + len);
    ctx.stroke();
    ctx.restore();
  }
  function drawTarget() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTargetCross();
  }
  function drawFunnel() {
    if (!showFunnel) return;
    const r = 10 * scaleFactor;
    ctx.save();
    ctx.strokeStyle = colors[currentRule];
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.setLineDash([3 * scaleFactor, 3 * scaleFactor]);
    ctx.beginPath();
    ctx.arc(funnel.x, funnel.y, r, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  function drawHit(h) {
    const r = 3 * scaleFactor;
    ctx.save();
    ctx.fillStyle = colors[currentRule];
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  function moveFunnel(h) {
    switch (currentRule) {
      case "2": funnel.x += target.x - h.x; funnel.y += target.y - h.y; break;
      case "3": funnel.x = 2 * target.x - h.x; funnel.y = 2 * target.y - h.y; break;
      case "4": funnel.x = h.x; funnel.y = h.y; break;
    }
  }
  function drawEnclosingCircle() {
    const m = Math.max(...hits.map(h => Math.hypot(h.x - target.x, h.y - target.y)));
    ctx.save();
    ctx.strokeStyle = colors[currentRule];
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, m, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors[currentRule];
    ctx.font = `${14 * scaleFactor}px sans-serif`;
    ctx.textAlign = "center";
    let lx, ly;
    if (currentRule === "1") { lx = target.x; ly = target.y - m - 12 * scaleFactor; ctx.textBaseline = "bottom"; }
    else if (currentRule === "2") { lx = target.x + m + 12 * scaleFactor; ly = target.y; ctx.textAlign = "left"; ctx.textBaseline = "middle"; }
    else if (currentRule === "3") { lx = target.x; ly = target.y + m + 12 * scaleFactor; ctx.textBaseline = "top"; }
    else { lx = target.x - m - 12 * scaleFactor; ly = target.y; ctx.textAlign = "right"; ctx.textBaseline = "middle"; }
    const ruleLabelY = (currentRule === "3") ? ly + 16 * scaleFactor : ly - 16 * scaleFactor;
    ctx.fillText(ruleNames[currentRule], lx, ruleLabelY);
    ctx.fillText(`⌀ ${(2 * m).toFixed(1)}`, lx, ly);
    ctx.restore();
    // Re-draw target cross so it remains visible
    drawTargetCross();
  }

  // Statistics & plotting
  function computeStats() {
    const d = hits.map(h => Math.hypot(h.x - target.x, h.y - target.y));
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const varc = d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length;
    const sd = Math.sqrt(varc), max = Math.max(...d);
    const pct1 = ((d.filter(v => v <= sd).length / d.length) * 100).toFixed(1);
    const pct2 = ((d.filter(v => v <= 2 * sd).length / d.length) * 100).toFixed(1);
    const pct3 = ((d.filter(v => v <= 3 * sd).length / d.length) * 100).toFixed(1);
    return { mean, sd, max, pct1, pct2, pct3 };
  }
  function updatePlot() {
    const traces = [];
    for (let r in allDistances) {
      if (allDistances[r].length) {
        traces.push({ x: allDistances[r], type: "histogram", opacity: 0.5, name: ruleNames[r], marker: { color: colors[r] }, autobinx: false, xbins: { start: 0, end: Math.max(...allDistances[r]), size: 1 } });
      }
    }
    const layout = {
      barmode: "overlay",
      title: "Distribution of Marble Distances from Target",
      autosize: true,
      margin: { t: 40, l: 40, r: 40, b: 40 },
      xaxis: { title: "Distance from Target (px)" },
      yaxis: { title: "Counts" }
    };
    const config = { responsive: true };
    Plotly.newPlot("plotlyHistogram", traces, layout, config);
  }
  function recordStats() {
    const s = computeStats();
    const e = document.createElement("div");
    e.className = "stat-entry";
    e.innerHTML = `<div class='entry-title' style='color:${colors[currentRule]}'>${ruleNames[currentRule]}</div><div>Mean: ${s.mean.toFixed(1)}</div><div>SD: ${s.sd.toFixed(1)}</div><div>Max: ${s.max.toFixed(1)}</div><div>% ≤1σ: ${s.pct1}%</div><div>% ≤2σ: ${s.pct2}%</div><div>% ≤3σ: ${s.pct3}%</div>`;
    statsDiv.appendChild(e);
  }

  // Core simulation step
  function dropMarble() {
    if (currentDrop >= totalDrops) {
      clearInterval(intervalId);
      drawEnclosingCircle();
      allDistances[currentRule] = hits.map(h => Math.hypot(h.x - target.x, h.y - target.y));
      updatePlot();
      recordStats();
      return;
    }
    drawFunnel();
    const { sigma, noiseModel } = config;
    let dx, dy;
    if (noiseModel === "truncated_drift") {
      const d = driftedNoise(sigma); dx = d.x; dy = d.y;
    } else {
      dx = gaussian(0, sigma); dy = gaussian(0, sigma);
    }
    const hit = { x: funnel.x + dx, y: funnel.y + dy };
    hits.push(hit);
    masterHits.push(hit);
    drawHit(hit);
    moveFunnel(hit);
    currentDrop++;
  }

  // Controls
  function start() {
    if (intervalId) clearInterval(intervalId);
    const raw = Object.fromEntries(new FormData(form).entries());
    config = {
      rule: raw.rule,
      sigma: parseFloat(raw.sigma),
      noiseModel: raw.noiseModel,
      totalDrops: parseInt(raw.drops, 10),
      interval: parseInt(raw.interval, 10),
      showFunnel: raw.showFunnel === "show"
    };
    currentRule = config.rule;
    totalDrops = config.totalDrops;
    currentDrop = 0;
    hits = [];
    funnel = { ...target };
    allDistances[currentRule] = [];
    showFunnel = config.showFunnel;
    drawTargetCross();
    intervalId = setInterval(dropMarble, config.interval);
  }
  function pause() {
    if (intervalId) clearInterval(intervalId);
  }
  function reset() {
    if (intervalId) clearInterval(intervalId);
    currentDrop = 0;
    hits = [];
    masterHits = [];
    funnel = { ...target };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r in allDistances) allDistances[r] = [];
    Plotly.purge("plotlyHistogram");
    document.getElementById("plotlyHistogram").innerHTML = "";
    statsDiv.innerHTML = "";
    drawTarget();
  }

  function exportCSV() {
    // Build an array of distances (in px) from target, with a 1-based index
    const rows = masterHits.map((h, idx) => {
        const dist = Math.hypot(h.x - target.x, h.y - target.y).toFixed(2);
        return `${idx + 1},${dist}`;
    });

    // Prepend header row
    rows.unshift("Index,Distance(px)");

    // Join into one string and encode
    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encoded = encodeURI(csvContent);

    // Create a temporary link, click it, then remove it
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", "marble_distances.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Initialize
  reset();
});
