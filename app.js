/**
 * State of Europe — interactive briefing
 */

const FRONTLINE = new Set(["PL", "EE", "LV", "LT", "FI", "RO"]);
const MIX_COLORS = {
  equipment: "#1f5c72",
  personnel: "#5a6f82",
  infrastructure: "#9a7b4f",
  other: "#a8b5c0",
};

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

  setupHeader();
  setupReveals();
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
/* UI chrome                                                                  */
/* -------------------------------------------------------------------------- */

function setupHeader() {
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupReveals() {
  const nodes = document.querySelectorAll(
    ".section-intro, .chart-block, .callout, .def, .figures-grid, .explorer, .sources-panel"
  );
  nodes.forEach((el) => el.classList.add("reveal"));
  if (reduceMotion) {
    nodes.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  nodes.forEach((el) => io.observe(el));
}

function animateFigures() {
  const figs = document.querySelectorAll(".figure-value[data-count]");
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
    const dur = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatCount(target * eased, prefix, suffix, decimals);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = formatCount(target, prefix, suffix, decimals);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  figs.forEach((el) => io.observe(el));
  // Headless / instant-load fallback
  requestAnimationFrame(() => {
    figs.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) run(el);
    });
  });
}

function formatCount(val, prefix, suffix, decimals) {
  if (decimals > 0) return `${prefix}${val.toFixed(decimals)}${suffix}`;
  if (suffix === "bn" || suffix === "%") {
    return `${prefix}${Math.round(val)}${suffix === "bn" ? "bn" : "%"}`;
  }
  return `${prefix}${Math.round(val)}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Hero map                                                                   */
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
  // Allies + neighbors for geographic context (ISO 3166-1 numeric)
  const neighborIds = new Set([40, 112, 756, 372, 804, 498, 688, 70, 51, 352, 20, 196, 470, 674, 643]);
  const collection = {
    type: "FeatureCollection",
    features: land.features.filter((f) => {
      const id = +f.id;
      return ISO_NUMERIC[id] || ISO_NUMERIC[f.id] || neighborIds.has(id);
    }),
  };

  const width = canvas.width;
  const height = canvas.height;
  const projection = d3.geoMercator().center([15, 54]).scale(width * 0.72).translate([width * 0.58, height * 0.48]);
  const path = d3.geoPath(projection, ctx);

  const maxGdp = 4.0;
  const color = (iso) => {
    const v = gdp[iso];
    if (v == null) return "#2c4a5c";
    const t = Math.min(1, Math.max(0, (v - 1.15) / (maxGdp - 1.15)));
    // Stronger Atlantic scale so the choropleth reads at hero scale
    if (t < 0.5) return lerpColor("#16384a", "#4f8fa8", t * 2);
    return lerpColor("#4f8fa8", "#e8f2f6", (t - 0.5) * 2);
  };

  function paint(progress = 1) {
    ctx.clearRect(0, 0, width, height);
    // deep field
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#0a1520");
    g.addColorStop(0.55, "#102233");
    g.addColorStop(1, "#0c1a28");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // subtle grid
    ctx.save();
    ctx.strokeStyle = "rgba(143, 163, 181, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // draw countries — neighbors first, allies on top
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
      ctx.lineWidth = 0.7;
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
      ctx.lineWidth = 1.15;
      ctx.stroke();
    }

    // glow dots on frontline capitals (approx)
    const capitals = {
      PL: [21.01, 52.23],
      EE: [24.75, 59.44],
      LV: [24.11, 56.95],
      LT: [25.28, 54.69],
      FI: [24.94, 60.17],
      DE: [13.4, 52.52],
      FR: [2.35, 48.86],
      GB: [-0.13, 51.51],
    };
    ctx.save();
    for (const [iso, ll] of Object.entries(capitals)) {
      const [x, y] = projection(ll);
      const r = FRONTLINE.has(iso) ? 3.2 : 2.2;
      ctx.beginPath();
      ctx.fillStyle = FRONTLINE.has(iso) ? "rgba(196, 140, 110, 0.95)" : "rgba(196, 215, 224, 0.85)";
      ctx.arc(x, y, r * progress, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (reduceMotion) {
    paint(1);
  } else {
    const start = performance.now();
    const dur = 1600;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      paint(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  canvas.classList.add("is-ready");
}

function paintFallbackHero(ctx, canvas) {
  const { width, height } = canvas;
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#0a1520");
  g.addColorStop(1, "#1a3344");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/* -------------------------------------------------------------------------- */
/* Canvas chart helpers                                                       */
/* -------------------------------------------------------------------------- */

function chartSurface(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = (canvas.height / canvas.width) * cssW;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

function drawAxes(ctx, plot, { yMin, yMax, yTicks, xLabels }) {
  const { x, y, w, h } = plot;
  ctx.strokeStyle = "#c9d3dc";
  ctx.fillStyle = "#5a6f82";
  ctx.lineWidth = 1;
  ctx.font = "12px Outfit, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (const tick of yTicks) {
    const yy = y + h - ((tick - yMin) / (yMax - yMin)) * h;
    ctx.strokeStyle = "rgba(201, 211, 220, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#5a6f82";
    ctx.fillText(formatAxis(tick), x - 8, yy);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const n = xLabels.length;
  xLabels.forEach((label, i) => {
    const xx = x + ((i + 0.5) / n) * w;
    ctx.fillText(label, xx, y + h + 10);
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
      const dur = 1100;
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
    { threshold: 0.2 }
  );
  io.observe(canvas);
  // Ensure charts paint even if IntersectionObserver never fires
  setTimeout(() => run(false), 1800);
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
    const plot = { x: 52, y: 18, w: w - 72, h: h - 58 };
    const yMax = 520;
    drawAxes(ctx, plot, {
      yMin: 0,
      yMax,
      yTicks: [0, 100, 200, 300, 400, 500],
      xLabels: years.map((y, i) => (i >= 3 ? `${y}e` : y)),
    });

    const n = years.length;
    const gap = 18;
    const barW = (plot.w - gap * (n + 1)) / n;

    values.forEach((v, i) => {
      const bh = (v / yMax) * plot.h * progress;
      const x = plot.x + gap + i * (barW + gap);
      const y = plot.y + plot.h - bh;
      const incomplete = years[i] === "2025";
      const grad = ctx.createLinearGradient(0, y, 0, plot.y + plot.h);
      grad.addColorStop(0, incomplete ? "#7a8f9c" : "#1f5c72");
      grad.addColorStop(1, incomplete ? "#5a6f82" : "#134355");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, bh);

      ctx.fillStyle = "#0b1522";
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if (progress > 0.85) {
        ctx.fillText(`$${Math.round(v)}`, x + barW / 2, y - 6);
      }
      if (incomplete && progress > 0.85) {
        ctx.fillStyle = "#5a6f82";
        ctx.font = "11px Outfit, sans-serif";
        ctx.fillText("ex-DE", x + barW / 2, y - 22);
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
    const plot = { x: 40, y: 20, w: w - 56, h: h - 56 };
    const yMax = 30;
    drawAxes(ctx, plot, {
      yMin: 0,
      yMax,
      yTicks: [0, 5, 10, 15, 20, 25, 30],
      xLabels: years.map((y, i) => (i >= 3 ? `${y}e` : y)),
    });

    // area + line
    ctx.beginPath();
    counts.forEach((c, i) => {
      const x = plot.x + ((i + 0.5) / counts.length) * plot.w;
      const y = plot.y + plot.h - ((c * progress) / yMax) * plot.h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#2f6f4e";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // fill
    ctx.lineTo(plot.x + ((counts.length - 0.5) / counts.length) * plot.w, plot.y + plot.h);
    ctx.lineTo(plot.x + (0.5 / counts.length) * plot.w, plot.y + plot.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
    g.addColorStop(0, "rgba(47, 111, 78, 0.28)");
    g.addColorStop(1, "rgba(47, 111, 78, 0.02)");
    ctx.fillStyle = g;
    ctx.fill();

    counts.forEach((c, i) => {
      const x = plot.x + ((i + 0.5) / counts.length) * plot.w;
      const y = plot.y + plot.h - ((c * progress) / yMax) * plot.h;
      ctx.beginPath();
      ctx.fillStyle = "#2f6f4e";
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b1522";
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if (progress > 0.8) ctx.fillText(String(Math.round(c * progress)), x, y - 8);
    });
  });
}

function drawEquipChart(data) {
  const canvas = document.getElementById("chart-equip");
  const legend = document.getElementById("legend-equip");
  legend.innerHTML = `
    <span><i style="background:#1f5c72"></i>Equipment</span>
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
    const plot = { x: 44, y: 18, w: w - 60, h: h - 54 };
    const yMin = 90;
    const yMax = 170;
    drawAxes(ctx, plot, {
      yMin,
      yMax,
      yTicks: [100, 120, 140, 160],
      xLabels: years,
    });

    const series = [
      { vals: totalIdx, color: "#8fa3b5", width: 2 },
      { vals: eqIdx, color: "#1f5c72", width: 2.75 },
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
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // baseline 100
    const y100 = plot.y + plot.h - ((100 - yMin) / (yMax - yMin)) * plot.h;
    ctx.setLineDash([4, 4]);
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
    <span><i style="background:${MIX_COLORS.infrastructure}"></i>Infrastructure</span>
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
  const plot = { x: 44, y: 16, w: w - 60, h: h - 52 };
  drawAxes(ctx, plot, {
    yMin: 0,
    yMax: 100,
    yTicks: [0, 25, 50, 75, 100],
    xLabels: years.map((y) => (Number(y) >= 2024 ? `${y}e` : y)),
  });

  const n = years.length;
  const gap = 14;
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
    const plot = { x: 48, y: 20, w: w - 88, h: h - 56 };
    const yMax = 100;
    drawAxes(ctx, plot, {
      yMin: 0,
      yMax,
      yTicks: [0, 25, 50, 75, 100],
      xLabels: years.map((y) => (y === "2024" ? "2024e" : y)),
    });

    // bars EUR
    const n = years.length;
    const gap = 22;
    const barW = (plot.w - gap * (n + 1)) / n * 0.62;
    eur.forEach((v, i) => {
      const bh = (v / yMax) * plot.h * progress;
      const x = plot.x + gap + i * ((plot.w - gap * (n + 1)) / n + gap);
      const y = plot.y + plot.h - bh;
      ctx.fillStyle = "#1f5c72";
      ctx.fillRect(x, y, barW, bh);
    });

    // GDP line on right axis 0-2.5
    const gMin = 0;
    const gMax = 2.5;
    ctx.beginPath();
    gdp.forEach((v, i) => {
      const slot = (plot.w - gap * (n + 1)) / n;
      const x = plot.x + gap + i * (slot + gap) + barW * 0.5;
      const vv = v * progress;
      const y = plot.y + plot.h - ((vv - gMin) / (gMax - gMin)) * plot.h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#9a7b4f";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    gdp.forEach((v, i) => {
      const slot = (plot.w - gap * (n + 1)) / n;
      const x = plot.x + gap + i * (slot + gap) + barW * 0.5;
      const vv = v * progress;
      const y = plot.y + plot.h - ((vv - gMin) / (gMax - gMin)) * plot.h;
      ctx.beginPath();
      ctx.fillStyle = "#9a7b4f";
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // right axis labels
    ctx.fillStyle = "#9a7b4f";
    ctx.font = "11px Outfit, sans-serif";
    ctx.textAlign = "left";
    [0, 1, 2].forEach((tick) => {
      const y = plot.y + plot.h - ((tick - gMin) / (gMax - gMin)) * plot.h;
      ctx.fillText(`${tick}%`, plot.x + plot.w + 8, y);
    });

    ctx.fillStyle = "#5a6f82";
    ctx.font = "11px Outfit, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("EUR bn (bars)", plot.x, 8);
    ctx.fillStyle = "#9a7b4f";
    ctx.fillText("% GDP (line)", plot.x + 100, 8);
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
    const plot = { x: 48, y: 28, w: w - 64, h: h - 64 };
    const yMax = 90;
    drawAxes(ctx, plot, {
      yMin: 0,
      yMax,
      yTicks: [0, 20, 40, 60, 80],
      xLabels: years.map(String),
    });

    const n = years.length;
    const gap = 20;
    const barW = (plot.w - gap * (n + 1)) / n;

    years.forEach((year, i) => {
      const a = (epl[year] || 0) * progress;
      const b = (sv[year] || 0) * progress;
      const x = plot.x + gap + i * (barW + gap);
      const h1 = (a / yMax) * plot.h;
      const h2 = (b / yMax) * plot.h;
      ctx.fillStyle = "#1f5c72";
      ctx.fillRect(x, plot.y + plot.h - h1 - h2, barW, h1);
      ctx.fillStyle = "#9a7b4f";
      ctx.fillRect(x, plot.y + plot.h - h2, barW, h2);
    });

    ctx.font = "11px Outfit, sans-serif";
    ctx.fillStyle = "#1f5c72";
    ctx.fillText("Einzelplan 14", plot.x, 10);
    ctx.fillStyle = "#9a7b4f";
    ctx.fillText("Sondervermögen cash", plot.x + 100, 10);
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
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        expand();
        io.disconnect();
      }
    },
    { threshold: 0.2 }
  );
  io.observe(root);
  setTimeout(expand, 1600);
}

/* -------------------------------------------------------------------------- */
/* Explorer                                                                   */
/* -------------------------------------------------------------------------- */

function setupExplorer(countries) {
  const list = document.getElementById("country-list");
  const detail = document.getElementById("country-detail");
  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));

  list.innerHTML = sorted
    .map((c) => `<button type="button" data-iso="${c.iso2}" aria-selected="false">${c.name}</button>`)
    .join("");

  const show = (iso) => {
    list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.iso === iso ? "true" : "false"));
    const c = countries.find((x) => x.iso2 === iso);
    detail.innerHTML = renderCountryDetail(c);
  };

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-iso]");
    if (btn) show(btn.dataset.iso);
  });

  show("PL");
}

function renderCountryDetail(c) {
  const y24 = c.years["2024"] || {};
  const y21 = c.years["2021"] || {};
  const y25 = c.years["2025"] || {};
  const gdp24 = y24.defence_expenditure_share_of_gdp;
  const usd24 = y24.defence_expenditure_current_usd;
  const eq24 = y24.equipment_share_of_defence_expenditure;
  const gdp21 = y21.defence_expenditure_share_of_gdp;
  const delta = gdp24 != null && gdp21 != null ? gdp24 - gdp21 : null;

  const years = ["2021", "2022", "2023", "2024", "2025"];
  const fmt = (v, digits = 2) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits === 0 ? 0 : Math.min(2, digits) }));
  const cell = (v, digits) => (v == null ? `<td class="na">—</td>` : `<td>${fmt(v, digits)}</td>`);

  return `
    <div class="detail-head">
      <h3>${c.name}</h3>
      <div class="detail-flags">
        <span class="tag">${c.iso2}</span>
        ${c.eu_member ? `<span class="tag">EU</span>` : ""}
        ${c.nordic ? `<span class="tag">Nordic</span>` : ""}
        <span class="tag">European NATO</span>
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
        <dt>Equipment share</dt>
        <dd>${eq24 != null ? eq24.toFixed(1) + "%" : "—"}</dd>
        <small>2024e · NATO category</small>
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
            <td>USD million</td>
            ${years.map((y) => cell(c.years[y]?.defence_expenditure_current_usd, 0)).join("")}
          </tr>
          <tr>
            <td>Equipment %</td>
            ${years.map((y) => cell(c.years[y]?.equipment_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Personnel %</td>
            ${years.map((y) => cell(c.years[y]?.personnel_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Infrastructure %</td>
            ${years.map((y) => cell(c.years[y]?.infrastructure_share_of_defence_expenditure, 1)).join("")}
          </tr>
          <tr>
            <td>Other %</td>
            ${years.map((y) => cell(c.years[y]?.other_share_of_defence_expenditure, 1)).join("")}
          </tr>
          ${y25.defence_expenditure_share_of_gdp != null ? "" : ""}
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
        <span class="source-meta">${s.publisher} · ${s.source_id}</span>
      </li>`
    )
    .join("");
}

main().catch((err) => {
  console.error(err);
  const hero = document.querySelector(".hero-lede");
  if (hero) {
    hero.textContent =
      "Could not load data.json. Serve this folder over HTTP (e.g. python3 -m http.server) and reload.";
  }
});
