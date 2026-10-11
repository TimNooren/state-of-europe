/**
 * State of Europe — dense dashboard
 */

const FRONTLINE = new Set(["PL", "EE", "LV", "LT", "FI", "RO"]);
const MIX_COLORS = {
  equipment: "#1a5f75",
  personnel: "#5a6f82",
  infrastructure: "#8a6d42",
  other: "#a8b5c0",
};
const FONT = "DM Sans, Segoe UI, sans-serif";

const ISO_NUMERIC = {
  8: "AL", 56: "BE", 100: "BG", 203: "CZ", 276: "DE", 208: "DK", 233: "EE",
  724: "ES", 246: "FI", 250: "FR", 826: "GB", 300: "GR", 191: "HR", 348: "HU",
  380: "IT", 440: "LT", 442: "LU", 428: "LV", 499: "ME", 807: "MK", 528: "NL",
  578: "NO", 616: "PL", 620: "PT", 642: "RO", 752: "SE", 705: "SI", 703: "SK",
  792: "TR",
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function main() {
  const data = await fetch("./data.json").then((r) => {
    if (!r.ok) throw new Error("Failed to load data.json");
    return r.json();
  });

  renderSources(data.sources);
  renderGdpBars(data.countries);
  setupMixChart(data.countries);
  setupExplorer(data.countries);
  drawTotalChart(data);
  drawThresholdChart(data);
  drawEquipChart(data);
  drawGermanyNato(data);
  drawGermanyBudget(data.germany);
  animateFigures();
  await drawHeroMap(data.countries);
}

/* -------------------------------------------------------------------------- */
/* Figures                                                                    */
/* -------------------------------------------------------------------------- */

function animateFigures() {
  const figs = document.querySelectorAll(".kpi-val[data-count]");
  const run = (el) => {
    if (el.dataset.animated) return;
    el.dataset.animated = "1";
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    if (reduceMotion) {
      el.textContent = formatCount(target, prefix, suffix, decimals);
      return;
    }
    el.textContent = formatCount(0, prefix, suffix, decimals);
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatCount(target * eased, prefix, suffix, decimals);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = formatCount(target, prefix, suffix, decimals);
    };
    requestAnimationFrame(tick);
  };
  figs.forEach(run);
}

function formatCount(val, prefix, suffix, decimals) {
  if (decimals > 0) return `${prefix}${val.toFixed(decimals)}${suffix}`;
  if (suffix === "bn" || suffix === "%") {
    return `${prefix}${Math.round(val)}${suffix === "bn" ? "bn" : "%"}`;
  }
  return `${prefix}${Math.round(val)}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Map                                                                        */
/* -------------------------------------------------------------------------- */

async function drawHeroMap(countries) {
  const canvas = document.getElementById("hero-map");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const byIso = Object.fromEntries(countries.map((c) => [c.iso2, c]));
  const gdp = {};
  for (const c of countries) {
    const v = c.years["2024"]?.defence_expenditure_share_of_gdp;
    if (v != null) gdp[c.iso2] = v;
  }

  let world;
  try {
    world = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((r) => r.json());
  } catch {
    paintFallbackHero(ctx, canvas);
    canvas.classList.add("is-ready");
    return;
  }

  const [{ feature }, d3] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/topojson-client@3/+esm"),
    import("https://cdn.jsdelivr.net/npm/d3-geo@3/+esm"),
  ]);

  const land = feature(world, world.objects.countries);
  const neighborIds = new Set([40, 112, 756, 372, 804, 498, 688, 70, 51, 352, 20, 196, 470, 674, 643]);
  const collection = {
    type: "FeatureCollection",
    features: land.features.filter((f) => {
      const id = +f.id;
      return ISO_NUMERIC[id] || ISO_NUMERIC[f.id] || neighborIds.has(id);
    }),
  };

  const paintAtSize = (progress = 1) => {
    const wrap = canvas.parentElement;
    const cssW = wrap?.clientWidth || 720;
    const cssH = wrap?.clientHeight || 520;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssW;
    const height = cssH;
    const projection = d3.geoMercator().center([15, 54]).scale(width * 0.85).translate([width * 0.52, height * 0.5]);
    const path = d3.geoPath(projection, ctx);

    const maxGdp = 4.0;
    const color = (iso) => {
      const v = gdp[iso];
      if (v == null) return "#2c4a5c";
      const t = Math.min(1, Math.max(0, (v - 1.15) / (maxGdp - 1.15)));
      if (t < 0.5) return lerpColor("#16384a", "#4f8fa8", t * 2);
      return lerpColor("#4f8fa8", "#e8f2f6", (t - 0.5) * 2);
    };

    ctx.clearRect(0, 0, width, height);
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#0a1520");
    g.addColorStop(0.55, "#102233");
    g.addColorStop(1, "#0c1a28");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const allies = [];
    const others = [];
    for (const f of collection.features) {
      const iso = ISO_NUMERIC[f.id] || ISO_NUMERIC[+f.id];
      if (iso && byIso[iso]) allies.push([f, iso]);
      else others.push(f);
    }
    for (const f of others) {
      ctx.beginPath();
      path(f);
      ctx.fillStyle = "rgba(28, 44, 58, 0.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(8, 16, 26, 0.4)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    for (const [f, iso] of allies) {
      ctx.beginPath();
      path(f);
      ctx.fillStyle = color(iso);
      ctx.globalAlpha = 0.55 + 0.45 * progress;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(8, 16, 26, 0.65)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    const capitals = {
      PL: [21.01, 52.23], EE: [24.75, 59.44], LV: [24.11, 56.95],
      LT: [25.28, 54.69], FI: [24.94, 60.17], DE: [13.4, 52.52],
      FR: [2.35, 48.86], GB: [-0.13, 51.51],
    };
    for (const [iso, ll] of Object.entries(capitals)) {
      const [x, y] = projection(ll);
      const r = FRONTLINE.has(iso) ? 2.8 : 2;
      ctx.beginPath();
      ctx.fillStyle = FRONTLINE.has(iso) ? "rgba(196, 140, 110, 0.95)" : "rgba(196, 215, 224, 0.85)";
      ctx.arc(x, y, r * progress, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (reduceMotion) paintAtSize(1);
  else {
    const start = performance.now();
    const dur = 1100;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      paintAtSize(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  canvas.classList.add("is-ready");
  window.addEventListener("resize", () => paintAtSize(1));
}

function paintFallbackHero(ctx, canvas) {
  const wrap = canvas.parentElement;
  const w = wrap?.clientWidth || 720;
  const h = wrap?.clientHeight || 520;
  canvas.width = w;
  canvas.height = h;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0a1520");
  g.addColorStop(1, "#1a3344");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return `rgb(${Math.round(pa.r + (pb.r - pa.r) * t)},${Math.round(pa.g + (pb.g - pa.g) * t)},${Math.round(pa.b + (pb.b - pa.b) * t)})`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/* -------------------------------------------------------------------------- */
/* Chart helpers                                                              */
/* -------------------------------------------------------------------------- */

function chartSurface(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const parent = canvas.parentElement;
  const cssW = canvas.clientWidth || parent?.clientWidth || canvas.width;
  const attrRatio = canvas.height / canvas.width;
  let cssH = cssW * attrRatio;
  // Prefer filling available flex space when parent has height
  if (parent && parent.clientHeight > 40 && canvas.previousElementSibling == null) {
    // leave for panels where canvas is sole flexible child — use attr ratio
  }
  const flexH = getFlexCanvasHeight(canvas);
  if (flexH) cssH = flexH;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

function getFlexCanvasHeight(canvas) {
  const panel = canvas.closest(".panel");
  if (!panel) return null;
  const head = panel.querySelector(".panel-head");
  const legend = panel.querySelector(".legend");
  const mini = canvas.previousElementSibling?.classList?.contains("mini-label")
    ? canvas.previousElementSibling
    : null;
  const used =
    (head?.offsetHeight || 0) +
    (legend?.offsetHeight || 0) +
    (mini?.offsetHeight || 0) +
    12;
  // Germany dual charts & mix/equip share panel height differently
  if (canvas.id.startsWith("chart-de-")) {
    const wrap = canvas.parentElement;
    const avail = wrap.clientHeight - (mini?.offsetHeight || 0) - 4;
    return avail > 60 ? avail : null;
  }
  const avail = panel.clientHeight - used;
  if (avail > 70 && (canvas.id === "chart-total" || canvas.id === "chart-threshold" || canvas.id === "chart-equip" || canvas.id === "chart-mix")) {
    return avail;
  }
  return null;
}

function drawAxes(ctx, plot, { yMin, yMax, yTicks, xLabels }) {
  const { x, y, w, h } = plot;
  ctx.lineWidth = 1;
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (const tick of yTicks) {
    const yy = y + h - ((tick - yMin) / (yMax - yMin)) * h;
    ctx.strokeStyle = "rgba(208, 216, 224, 0.85)";
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#5a6f82";
    ctx.fillText(formatAxis(tick), x - 6, yy);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const n = xLabels.length;
  xLabels.forEach((label, i) => {
    const xx = x + ((i + 0.5) / n) * w;
    ctx.fillText(label, xx, y + h + 6);
  });
}

function formatAxis(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function observeDraw(canvas, drawFn) {
  let drawn = false;
  const run = (animate) => {
    if (drawn) {
      drawFn(1);
      return;
    }
    drawn = true;
    if (!animate || reduceMotion) drawFn(1);
    else {
      const start = performance.now();
      const dur = 850;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        drawFn(1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        run(true);
        io.disconnect();
      }
    },
    { threshold: 0.15 }
  );
  io.observe(canvas);
  setTimeout(() => run(false), 1200);
  window.addEventListener("resize", () => {
    if (drawn) drawFn(1);
  });
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                     */
/* -------------------------------------------------------------------------- */

function drawTotalChart(data) {
  const canvas = document.getElementById("chart-total");
  const years = ["2021", "2022", "2023", "2024", "2025"];
  const values = years.map((y) => data.aggregates.total_usd[y] / 1000);

  observeDraw(canvas, (progress) => {
    const { ctx, w, h } = chartSurface(canvas);
    ctx.clearRect(0, 0, w, h);
    const plot = { x: 36, y: 14, w: w - 48, h: h - 36 };
    const yMax = 520;
    drawAxes(ctx, plot, {
      yMin: 0, yMax,
      yTicks: [0, 200, 400],
      xLabels: years.map((y, i) => (i >= 3 ? `${y}e` : y)),
    });

    const n = years.length;
    const gap = 10;
    const barW = (plot.w - gap * (n + 1)) / n;

    values.forEach((v, i) => {
      const bh = (v / yMax) * plot.h * progress;
      const x = plot.x + gap + i * (barW + gap);
      const y = plot.y + plot.h - bh;
      const incomplete = years[i] === "2025";
      const grad = ctx.createLinearGradient(0, y, 0, plot.y + plot.h);
      grad.addColorStop(0, incomplete ? "#7a8f9c" : "#1a5f75");
      grad.addColorStop(1, incomplete ? "#5a6f82" : "#0f4456");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, bh);

      if (progress > 0.85) {
        ctx.fillStyle = "#0e1824";
        ctx.font = `600 10px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`$${Math.round(v)}`, x + barW / 2, y - 3);
        if (incomplete) {
          ctx.fillStyle = "#5a6f82";
          ctx.font = `9px ${FONT}`;
          ctx.fillText("ex-DE", x + barW / 2, y - 14);
        }
      }
    });
  });
}

function drawThresholdChart(data) {
  const canvas = document.getElementById("chart-threshold");
  const years = ["2021", "2022", "2023", "2024", "2025"];
  const counts = years.map((y) => data.aggregates.above_2pct[y].count);

  observeDraw(canvas, (progress) => {
    const { ctx, w, h } = chartSurface(canvas);
    ctx.clearRect(0, 0, w, h);
    const plot = { x: 28, y: 14, w: w - 40, h: h - 36 };
    const yMax = 30;
    drawAxes(ctx, plot, {
      yMin: 0, yMax,
      yTicks: [0, 10, 20, 30],
      xLabels: years.map((y, i) => (i >= 3 ? `${y}e` : y)),
    });

    ctx.beginPath();
    counts.forEach((c, i) => {
      const x = plot.x + ((i + 0.5) / counts.length) * plot.w;
      const y = plot.y + plot.h - ((c * progress) / yMax) * plot.h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#2a6b4a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(plot.x + ((counts.length - 0.5) / counts.length) * plot.w, plot.y + plot.h);
    ctx.lineTo(plot.x + (0.5 / counts.length) * plot.w, plot.y + plot.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
    g.addColorStop(0, "rgba(42, 107, 74, 0.28)");
    g.addColorStop(1, "rgba(42, 107, 74, 0.02)");
    ctx.fillStyle = g;
    ctx.fill();

    counts.forEach((c, i) => {
      const x = plot.x + ((i + 0.5) / counts.length) * plot.w;
      const y = plot.y + plot.h - ((c * progress) / yMax) * plot.h;
      ctx.beginPath();
      ctx.fillStyle = "#2a6b4a";
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      if (progress > 0.8) {
        ctx.fillStyle = "#0e1824";
        ctx.font = `600 10px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(Math.round(c * progress)), x, y - 5);
      }
    });
  });
}

function drawEquipChart(data) {
  const canvas = document.getElementById("chart-equip");
  document.getElementById("legend-equip").innerHTML = `
    <span><i style="background:#1a5f75"></i>Equipment</span>
    <span><i style="background:#8fa3b5"></i>Total defence</span>
  `;

  const years = ["2021", "2022", "2023", "2024"];
  const tot0 = data.aggregates.total_usd["2021"];
  const eq0 = data.aggregates.equipment_usd["2021"];
  const totalIdx = years.map((y) => (data.aggregates.total_usd[y] / tot0) * 100);
  const eqIdx = years.map((y) => (data.aggregates.equipment_usd[y] / eq0) * 100);

  observeDraw(canvas, (progress) => {
    const { ctx, w, h } = chartSurface(canvas);
    ctx.clearRect(0, 0, w, h);
    const plot = { x: 32, y: 10, w: w - 44, h: h - 32 };
    const yMin = 90;
    const yMax = 170;
    drawAxes(ctx, plot, {
      yMin, yMax,
      yTicks: [100, 130, 160],
      xLabels: years,
    });

    const series = [
      { vals: totalIdx, color: "#8fa3b5", width: 1.75 },
      { vals: eqIdx, color: "#1a5f75", width: 2.25 },
    ];

    for (const s of series) {
      ctx.beginPath();
      s.vals.forEach((v, i) => {
        const x = plot.x + ((i + 0.5) / s.vals.length) * plot.w;
        const vv = 100 + (v - 100) * progress;
        const y = plot.y + plot.h - ((vv - yMin) / (yMax - yMin)) * plot.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.stroke();
      s.vals.forEach((v, i) => {
        const x = plot.x + ((i + 0.5) / s.vals.length) * plot.w;
        const vv = 100 + (v - 100) * progress;
        const y = plot.y + plot.h - ((vv - yMin) / (yMax - yMin)) * plot.h;
        ctx.beginPath();
        ctx.fillStyle = s.color;
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const y100 = plot.y + plot.h - ((100 - yMin) / (yMax - yMin)) * plot.h;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(90, 111, 130, 0.55)";
    ctx.beginPath();
    ctx.moveTo(plot.x, y100);
    ctx.lineTo(plot.x + plot.w, y100);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function setupMixChart(countries) {
  const select = document.getElementById("mix-country");
  const canvas = document.getElementById("chart-mix");
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = sorted.map((c) => `<option value="${c.iso2}">${c.name}</option>`).join("");
  select.value = "DE";

  document.getElementById("legend-mix").innerHTML = `
    <span><i style="background:${MIX_COLORS.equipment}"></i>Equipment</span>
    <span><i style="background:${MIX_COLORS.personnel}"></i>Personnel</span>
    <span><i style="background:${MIX_COLORS.infrastructure}"></i>Infra</span>
    <span><i style="background:${MIX_COLORS.other}"></i>Other</span>
  `;

  const paint = (progress) => {
    const country = countries.find((c) => c.iso2 === select.value);
    if (!country) return;
    drawMixChart(canvas, country, progress);
  };

  observeDraw(canvas, paint);
  select.addEventListener("change", () => paint(1));
  window.addEventListener("resize", () => paint(1));
}

function drawMixChart(canvas, country, progress) {
  const years = ["2021", "2022", "2023", "2024", "2025"].filter((y) => {
    const yd = country.years[y];
    return yd && yd.equipment_share_of_defence_expenditure != null;
  });

  const keys = [
    ["equipment_share_of_defence_expenditure", "equipment"],
    ["personnel_share_of_defence_expenditure", "personnel"],
    ["infrastructure_share_of_defence_expenditure", "infrastructure"],
    ["other_share_of_defence_expenditure", "other"],
  ];

  const { ctx, w, h } = chartSurface(canvas);
  ctx.clearRect(0, 0, w, h);
  const plot = { x: 32, y: 8, w: w - 44, h: h - 30 };
  drawAxes(ctx, plot, {
    yMin: 0, yMax: 100,
    yTicks: [0, 50, 100],
    xLabels: years.map((y) => (Number(y) >= 2024 ? `${y}e` : y)),
  });

  const n = years.length;
  const gap = 8;
  const barW = (plot.w - gap * (n + 1)) / n;

  years.forEach((year, i) => {
    const yd = country.years[year];
    let stack = 0;
    const x = plot.x + gap + i * (barW + gap);
    keys.forEach(([metric, key]) => {
      const share = yd[metric] || 0;
      const bh = (share / 100) * plot.h * progress;
      const y = plot.y + plot.h - stack - bh;
      ctx.fillStyle = MIX_COLORS[key];
      ctx.fillRect(x, y, barW, bh);
      stack += bh;
    });
  });
}

function drawGermanyNato(data) {
  const canvas = document.getElementById("chart-de-nato");
  const de = data.countries.find((c) => c.iso2 === "DE");
  const years = ["2021", "2022", "2023", "2024"];
  const eur = years.map((y) => de.years[y].defence_expenditure_national_currency / 1000);
  const gdp = years.map((y) => de.years[y].defence_expenditure_share_of_gdp);

  observeDraw(canvas, (progress) => {
    const { ctx, w, h } = chartSurface(canvas);
    ctx.clearRect(0, 0, w, h);
    const plot = { x: 32, y: 16, w: w - 64, h: h - 36 };
    const yMax = 100;
    drawAxes(ctx, plot, {
      yMin: 0, yMax,
      yTicks: [0, 50, 100],
      xLabels: years.map((y) => (y === "2024" ? "2024e" : y)),
    });

    const n = years.length;
    const gap = 14;
    const slot = (plot.w - gap * (n + 1)) / n;
    const barW = slot * 0.58;
    eur.forEach((v, i) => {
      const bh = (v / yMax) * plot.h * progress;
      const x = plot.x + gap + i * (slot + gap);
      ctx.fillStyle = "#1a5f75";
      ctx.fillRect(x, plot.y + plot.h - bh, barW, bh);
    });

    const gMin = 0;
    const gMax = 2.5;
    ctx.beginPath();
    gdp.forEach((v, i) => {
      const x = plot.x + gap + i * (slot + gap) + barW * 0.5;
      const y = plot.y + plot.h - ((v * progress - gMin) / (gMax - gMin)) * plot.h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#8a6d42";
    ctx.lineWidth = 2;
    ctx.stroke();

    gdp.forEach((v, i) => {
      const x = plot.x + gap + i * (slot + gap) + barW * 0.5;
      const y = plot.y + plot.h - ((v * progress - gMin) / (gMax - gMin)) * plot.h;
      ctx.beginPath();
      ctx.fillStyle = "#8a6d42";
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#8a6d42";
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = "left";
    [0, 1, 2].forEach((tick) => {
      const y = plot.y + plot.h - ((tick - gMin) / (gMax - gMin)) * plot.h;
      ctx.fillText(`${tick}%`, plot.x + plot.w + 5, y);
    });

    ctx.fillStyle = "#5a6f82";
    ctx.fillText("EUR bn", plot.x, 8);
    ctx.fillStyle = "#8a6d42";
    ctx.fillText("% GDP", plot.x + 52, 8);
  });
}

function drawGermanyBudget(germany) {
  const canvas = document.getElementById("chart-de-budget");
  const years = [2022, 2023, 2024, 2025];
  const epl = {};
  const sv = {};
  for (const row of germany.national_budget) {
    if (row.metric === "einzelplan_14_total") epl[row.year] = row.value / 1000;
    if (row.metric === "sondervermoegen_bundeswehr_cash_outlay") sv[row.year] = row.value / 1000;
  }

  observeDraw(canvas, (progress) => {
    const { ctx, w, h } = chartSurface(canvas);
    ctx.clearRect(0, 0, w, h);
    const plot = { x: 32, y: 16, w: w - 44, h: h - 36 };
    const yMax = 90;
    drawAxes(ctx, plot, {
      yMin: 0, yMax,
      yTicks: [0, 40, 80],
      xLabels: years.map(String),
    });

    const n = years.length;
    const gap = 12;
    const barW = (plot.w - gap * (n + 1)) / n;

    years.forEach((year, i) => {
      const a = (epl[year] || 0) * progress;
      const b = (sv[year] || 0) * progress;
      const x = plot.x + gap + i * (barW + gap);
      const h1 = (a / yMax) * plot.h;
      const h2 = (b / yMax) * plot.h;
      ctx.fillStyle = "#1a5f75";
      ctx.fillRect(x, plot.y + plot.h - h1 - h2, barW, h1);
      ctx.fillStyle = "#8a6d42";
      ctx.fillRect(x, plot.y + plot.h - h2, barW, h2);
    });

    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = "#1a5f75";
    ctx.fillText("EPL14", plot.x, 8);
    ctx.fillStyle = "#8a6d42";
    ctx.fillText("Sondervermögen", plot.x + 42, 8);
  });
}

/* -------------------------------------------------------------------------- */
/* GDP bars                                                                   */
/* -------------------------------------------------------------------------- */

function renderGdpBars(countries) {
  const root = document.getElementById("gdp-bars");
  const rows = countries
    .map((c) => ({
      name: c.name,
      iso: c.iso2,
      gdp: c.years["2024"]?.defence_expenditure_share_of_gdp,
    }))
    .filter((r) => r.gdp != null)
    .sort((a, b) => b.gdp - a.gdp);

  const max = 4.5;
  root.innerHTML = rows
    .map(
      (r) => `
      <div class="gdp-row ${FRONTLINE.has(r.iso) ? "is-front" : ""} is-guide" data-iso="${r.iso}" role="listitem">
        <span class="gdp-name" title="${r.name}">${r.name}</span>
        <div class="gdp-track"><div class="gdp-fill" data-width="${(r.gdp / max) * 100}"></div></div>
        <span class="gdp-val">${r.gdp.toFixed(2)}</span>
      </div>`
    )
    .join("");

  const fills = root.querySelectorAll(".gdp-fill");
  const expand = () => fills.forEach((el) => { el.style.width = `${el.dataset.width}%`; });
  requestAnimationFrame(() => setTimeout(expand, 80));
}

/* -------------------------------------------------------------------------- */
/* Explorer                                                                   */
/* -------------------------------------------------------------------------- */

function setupExplorer(countries) {
  const select = document.getElementById("country-select");
  const detail = document.getElementById("country-detail");
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));

  select.innerHTML = sorted.map((c) => `<option value="${c.iso2}">${c.name}</option>`).join("");
  select.value = "PL";

  const show = (iso) => {
    const c = countries.find((x) => x.iso2 === iso);
    detail.innerHTML = renderCountryDetail(c);
  };

  select.addEventListener("change", () => show(select.value));
  show("PL");
}

function renderCountryDetail(c) {
  const y24 = c.years["2024"] || {};
  const y21 = c.years["2021"] || {};
  const gdp24 = y24.defence_expenditure_share_of_gdp;
  const usd24 = y24.defence_expenditure_current_usd;
  const eq24 = y24.equipment_share_of_defence_expenditure;
  const gdp21 = y21.defence_expenditure_share_of_gdp;
  const delta = gdp24 != null && gdp21 != null ? gdp24 - gdp21 : null;

  const years = ["2021", "2022", "2023", "2024", "2025"];
  const fmt = (v, digits = 2) =>
    v == null
      ? "—"
      : Number(v).toLocaleString("en-US", {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits === 0 ? 0 : Math.min(2, digits),
        });
  const cell = (v, digits) => (v == null ? `<td class="na">—</td>` : `<td>${fmt(v, digits)}</td>`);

  return `
    <div class="detail-head">
      <h3>${c.name}</h3>
      <div class="detail-flags">
        <span class="tag">${c.iso2}</span>
        ${c.eu_member ? `<span class="tag">EU</span>` : ""}
        ${c.nordic ? `<span class="tag">Nordic</span>` : ""}
      </div>
    </div>
    <dl class="detail-stats">
      <div class="detail-stat">
        <dt>GDP share 2024e</dt>
        <dd>${gdp24 != null ? gdp24.toFixed(2) + "%" : "—"}</dd>
        <small>${delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pp vs 2021` : ""}</small>
      </div>
      <div class="detail-stat">
        <dt>Spend 2024e</dt>
        <dd>${usd24 != null ? "$" + (usd24 / 1000).toFixed(1) + "bn" : "—"}</dd>
        <small>Current USD</small>
      </div>
      <div class="detail-stat">
        <dt>Equipment</dt>
        <dd>${eq24 != null ? eq24.toFixed(1) + "%" : "—"}</dd>
        <small>Share 2024e</small>
      </div>
    </dl>
    <div class="detail-table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${years.map((y) => `<th>${Number(y) >= 2024 ? y + "e" : y}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>% of GDP</td>
            ${years.map((y) => cell(c.years[y]?.defence_expenditure_share_of_gdp, 2)).join("")}
          </tr>
          <tr>
            <td>USD m</td>
            ${years.map((y) => cell(c.years[y]?.defence_expenditure_current_usd, 0)).join("")}
          </tr>
          <tr>
            <td>Equip %</td>
            ${years.map((y) => cell(c.years[y]?.equipment_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Personnel %</td>
            ${years.map((y) => cell(c.years[y]?.personnel_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Infra %</td>
            ${years.map((y) => cell(c.years[y]?.infrastructure_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Other %</td>
            ${years.map((y) => cell(c.years[y]?.other_share_of_defence_expenditure, 1)).join("")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/* Sources                                                                    */
/* -------------------------------------------------------------------------- */

function renderSources(sources) {
  const ul = document.getElementById("source-list");
  ul.innerHTML = sources
    .map(
      (s) => `
      <li>
        <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.short_name}</a>
        <span class="source-meta">${s.source_id}</span>
      </li>`
    )
    .join("");
}

main().catch((err) => {
  console.error(err);
  const tag = document.querySelector(".tagline");
  if (tag) {
    tag.textContent =
      "Could not load data.json — serve this folder over HTTP and reload.";
  }
});
