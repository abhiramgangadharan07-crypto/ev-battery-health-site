/* EV Battery Lab — front-end logic
   Prediction is plain client-side math: SoH = intercept + sum(coef_i * x_i) */

"use strict";

const MODEL_URL = "assets/model.json";
const POINTS_URL = "assets/points.json";

const FEATURE_META = {
  Cycle: { unit: "cycles", step: 1, desc: "number of charge/discharge cycles" },
  Voltage: { unit: "V", step: 0.01, desc: "cell voltage" },
  Current: { unit: "A", step: 0.01, desc: "charge/discharge current" },
  Temperature: { unit: "\u00b0C", step: 0.1, desc: "cell temperature" },
  ChargeTime: { unit: "s", step: 0.1, desc: "time to charge" },
  DischargeTime: { unit: "s", step: 0.1, desc: "time to discharge" },
  InternalResistance: { unit: "\u03a9", step: 0.0001, desc: "internal resistance" },
  Capacity: { unit: "Ah", step: 0.01, desc: "measured capacity" },
  AmbientHumidity: { unit: "%", step: 0.1, desc: "ambient humidity" },
  C_Rate: { unit: "", step: 0.01, desc: "C-rate of the cycle" },
};

const FEATURE_DECIMALS = {
  Cycle: 0,
  Voltage: 2,
  Current: 2,
  Temperature: 1,
  ChargeTime: 1,
  DischargeTime: 1,
  InternalResistance: 4,
  Capacity: 2,
  AmbientHumidity: 1,
  C_Rate: 2,
};

let MODEL = null;

/* ---------------- prediction ---------------- */

function predictSoH(features) {
  let soh = MODEL.intercept;
  for (const f of MODEL.feature_order) {
    soh += MODEL.coefficients[f] * features[f];
  }
  return soh;
}

/* ---------------- health levels ---------------- */

function healthLevel(soh) {
  if (soh >= 90) return { key: "excellent", label: "Excellent \u2014 healthy cell", cls: "" };
  if (soh >= 80) return { key: "good", label: "Good \u2014 watch the trend", cls: "good" };
  return { key: "dead", label: "End of life \u2014 replace", cls: "dead" };
}

function healthColor(soh) {
  // green (100) -> amber (75) -> terracotta (45)
  const stops = [
    { t: 100, c: [63, 191, 95] },
    { t: 75, c: [232, 161, 60] },
    { t: 45, c: [217, 93, 63] },
  ];
  const s = Math.max(stops[2].t, Math.min(stops[0].t, soh));
  let a = stops[0], b = stops[1];
  if (s < 75) { a = stops[1]; b = stops[2]; }
  const k = (s - a.t) / (b.t - a.t);
  return [a.c[0] + (b.c[0] - a.c[0]) * k,
          a.c[1] + (b.c[1] - a.c[1]) * k,
          a.c[2] + (b.c[2] - a.c[2]) * k];
}

function cssColor(rgb) {
  return `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
}

/* ---------------- form ---------------- */

let batterySceneApi = null;

function buildForm() {
  const list = document.getElementById("slider-list");
  list.innerHTML = "";
  for (const f of MODEL.feature_order) {
    const r = MODEL.feature_ranges[f];
    const meta = FEATURE_META[f] || { unit: "", step: 0.01, desc: "" };
    const dec = FEATURE_DECIMALS[f] ?? 2;

    const row = document.createElement("div");
    row.className = "slider-row reveal";
    row.innerHTML = `
      <div class="top">
        <span class="name">${f} <small>${meta.desc}${meta.unit ? " \u00b7 " + meta.unit : ""}</small></span>
        <span class="val" id="val-${f}"></span>
      </div>
      <input type="range" id="in-${f}" min="${r.min}" max="${r.max}" step="${meta.step}"
             value="${r.mean.toFixed(dec)}" />
      <div class="range-note"><span>${r.min.toFixed(dec)}</span><span>${r.max.toFixed(dec)}</span></div>
    `;
    list.appendChild(row);

    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      document.getElementById(`val-${f}`).textContent =
        parseFloat(input.value).toFixed(dec);
      updateDiagnosis(false);
    });
    document.getElementById(`val-${f}`).textContent = input.value;
  }

  const actions = document.querySelector(".form-actions");
  const reset = document.createElement("button");
  reset.className = "btn";
  reset.type = "button";
  reset.textContent = "Reset to typical";
  reset.addEventListener("click", () => {
    for (const f of MODEL.feature_order) {
      const input = document.getElementById(`in-${f}`);
      const dec = FEATURE_DECIMALS[f] ?? 2;
      input.value = MODEL.feature_ranges[f].mean.toFixed(dec);
      document.getElementById(`val-${f}`).textContent = input.value;
    }
    updateDiagnosis(true);
  });
  actions.appendChild(reset);
}

function collectFeatures() {
  const features = {};
  for (const f of MODEL.feature_order) {
    features[f] = parseFloat(document.getElementById(`in-${f}`).value);
  }
  return features;
}

function updateDiagnosis(animate) {
  const soh = predictSoH(collectFeatures());
  const clamped = Math.max(0, Math.min(100, soh));
  const level = healthLevel(clamped);

  const num = document.getElementById("soh-big");
  num.textContent = clamped.toFixed(1);
  num.style.color = cssColor(healthColor(clamped));

  const badge = document.getElementById("health-badge");
  badge.className = "badge " + level.cls;
  badge.innerHTML = `<span class="bdot"></span>${level.label}`;

  document.getElementById("diag-note").textContent =
    clamped >= 80
      ? "This pack still clears the 80% end-of-life threshold. Keep an eye on the trend."
      : "This pack has fallen below the 80% end-of-life threshold \u2014 schedule a check-up or replacement.";

  if (batterySceneApi) batterySceneApi.setSoH(clamped, animate !== false);
}

/* ---------------- stat counters ---------------- */

function animateCounter(el) {
  const target = parseFloat(el.dataset.count);
  const isPct = el.dataset.count.includes(".");
  const dur = 1100;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = isPct
      ? (target * eased).toFixed(4)
      : Math.round(target * eased).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- scroll reveal ---------------- */

function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const cio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.querySelectorAll("[data-count]").forEach(animateCounter);
          cio.unobserve(e.target);
        }
      }
    },
    { threshold: 0.4 }
  );
  document.querySelectorAll("[data-counters]").forEach((el) => cio.observe(el));
}

/* ---------------- tilt on results cards ---------------- */

function initTilt() {
  const cards = document.querySelectorAll(".metric");
  for (const card of cards) {
    card.addEventListener("mousemove", (ev) => {
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg) translateY(-3px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }
}

/* ---------------- boot ---------------- */

async function boot() {
  try {
    MODEL = await (await fetch(MODEL_URL)).json();
  } catch (err) {
    document.getElementById("predictor").innerHTML =
      '<p class="lead" style="padding:40px">Could not load the model (assets/model.json). Serve the site over HTTP, e.g. <span class="mono">python -m http.server</span>.</p>';
    return;
  }

  buildForm();
  updateDiagnosis(true);

  // pass model + points into the 3D scenes
  if (window.SceneKit) {
    window.SceneKit.init(MODEL, POINTS_URL, { onBattery: (api) => (batterySceneApi = api) });
  }

  initReveal();
  initTilt();

  document.getElementById("year").textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", boot);
