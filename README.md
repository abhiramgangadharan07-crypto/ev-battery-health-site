<div align="center">

# EV Battery Lab — State of Health Predictor

**Estimate the remaining life of an EV battery pack — directly in your browser.**

A live, fully static web application that predicts the **State of Health (SoH)** of an electric-vehicle battery from ten everyday sensor readings, using a linear regression model trained on **2,000 real battery samples**. No server, no upload, no API keys — the entire model ships with the site and runs client-side.

[![Live demo](https://img.shields.io/badge/LIVE%20DEMO-GitHub%20Pages-3FBF5F?style=for-the-badge&logo=github)](https://abhiramgangadharan07-crypto.github.io/ev-battery-health-site/)
[![R² score](https://img.shields.io/badge/R%C2%B2-0.9967-2e9b4a?style=for-the-badge)](https://abhiramgangadharan07-crypto.github.io/ev-battery-health-site/)
[![RMSE](https://img.shields.io/badge/RMSE-1.08%20pp-D95D3F?style=for-the-badge)](https://abhiramgangadharan07-crypto.github.io/ev-battery-health-site/)
[![Samples](https://img.shields.io/badge/trained%20on-2000%20samples-E8A13C?style=for-the-badge)](https://abhiramgangadharan07-crypto.github.io/ev-battery-health-site/)

[![Built with](https://img.shields.io/badge/HTML5-CSS3-JavaScript-F6F1E7?style=for-the-badge&logo=html5&logoColor=1C3A2E)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Three.js](https://img.shields.io/badge/Three.js-r128-000000?style=for-the-badge&logo=threedotjs)](https://threejs.org/)
[![Model](https://img.shields.io/badge/sklearn-LinearRegression-F7931E?style=for-the-badge&logo=scikitlearn)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-MIT-1C3A2E?style=for-the-badge)](LICENSE)

</div>

---

## Table of contents

- [Overview](#overview)
- [Screenshot](#screenshot)
- [Features](#features)
- [How the prediction works](#how-the-prediction-works)
- [Performance](#performance)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Regenerating the model data](#regenerating-the-model-data)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Author](#author)
- [License](#license)
- [Credits](#credits)

## Overview

Every time an EV battery is charged, discharged, or thermally stressed, it permanently loses a tiny slice of its capacity. The **State of Health (SoH)** is the standard measure of how much of its original capacity remains — a new battery starts near 100% and is generally considered **end of life at 80%**.

This project answers a practical question: *can we estimate SoH without expensive laboratory equipment, using only the sensor readings a battery management system already records?*

Yes — with a single linear model. This repository is the interactive companion to the [EV Battery Health Prediction](https://github.com/abhiramgangadharan07-crypto/ev-battery-health-prediction) machine-learning project:

- **10 sensor features** (cycle count, voltage, current, temperature, …) → **one SoH prediction**
- Trained on **2,000 samples** with `scikit-learn` (`LinearRegression`, `random_state=42`)
- **R² = 0.9967** and **RMSE = 1.08 percentage points** on 400 unseen test samples
- The trained model ships as a single JSON file, so the site runs the full prediction **in your browser** with zero backend

## Screenshot

![Full-page preview of the EV Battery Lab site](assets/screenshot.png)

## Features

### 1. 360° 3D EV showcase

A draggable, auto-rotating 3D car (Three.js + a Draco-compressed GLB decoded locally) sits in the hero. Drag to inspect from any angle — the car resumes orbiting when you let go.

### 2. Live SoH diagnosis

Ten sliders, ranged from the real dataset's minimum/maximum, feed the model as you move them. The prediction updates **instantly** client-side, and a 3D battery fills or drains to your result, shifting from **green (healthy)** through **amber (degraded)** to **terracotta (end of life)**.

### 3. 3D data landscape

All 2,000 training samples are rendered as a rotatable point cloud (Cycle × Temperature × SoH); color encodes health exactly as in the battery visualisation.

### 4. Full methodology, in plain language

The site includes the complete regression story — the pipeline (load → inspect → clean → encode → split → train → evaluate → visualise), the metric explanations, and the full precision coefficient table.

## How the prediction works

A linear regression makes a prediction by multiplying each feature by a learned coefficient, adding them all up, and adding an intercept. For this model:

```
SoH = 94.498
    − 0.0322 × Cycle
    − 0.0997 × Voltage
    − 0.0639 × Current
    − 0.0224 × Temperature
    − 0.0009 × ChargeTime
    − 0.0014 × DischargeTime
    + 2.3856 × InternalResistance
    − 0.0972 × Capacity
    − 0.0003 × AmbientHumidity
    + 0.0562 × C_Rate
```

**Worked example** — a typical mid-life pack with the dataset's average readings (Cycle 1,000, Voltage 3.59 V, Current 1.24 A, Temperature 25.3 °C, …):

```
SoH ≈ 94.498
    − 32.229   (Cycle)
    − 0.358    (Voltage)
    − 0.079    (Current)
    − 0.567    (Temperature)
    − 0.069    (ChargeTime)
    − 0.107    (DischargeTime)
    + 0.358    (InternalResistance)
    − 0.194    (Capacity)
    − 0.017    (AmbientHumidity)
    + 0.071    (C_Rate)
    = 61.3%    (predicted SoH)
```

**Reading the coefficients:** `Cycle` dominates (−0.032 per cycle — each full charge/discharge cycle costs about 0.03 percentage points of health); `Temperature` (−0.022 per °C) shows thermal stress ages the pack; `InternalResistance` is the strongest positive term (+2.386), because a freshly rebuilt estimate correlates with the resistance reading this dataset records for healthier cells. `ChargeTime`, `DischargeTime` and `AmbientHumidity` are near-zero — they refine the estimate without changing the story.

The coefficients are stored **full precision** in `assets/model.json`; the on-page calculator (`js/app.js`) and the Python export (`export_model.py`) are cross-checked by `crosscheck.py` to a difference of ~1e-14 — so the number you see in the browser is the number scikit-learn produced.

## Performance

Evaluated on **400 samples** the model never saw during training:

| Metric | Value | Meaning |
| ------ | ----- | ------- |
| **R² (coefficient of determination)** | **0.9967** | The model explains 99.67% of the variation in battery health |
| **RMSE (root mean square error)** | **1.08 pp** | Typical predictions are within ±1 percentage point of true SoH |
| Training samples | 1,600 | 80% of the dataset |
| Test samples | 400 | 20% held out with `random_state=42` |

The evaluation scatter plot (actual vs predicted, with the perfect-prediction diagonal) is included in the site and in the companion project.

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Markup & styling | Semantic HTML5, hand-written CSS (paper & forest-green editorial theme, responsive) |
| 3D rendering | Three.js r128 (car, battery fill, point cloud) + vendored Draco decoder for the GLB |
| Prediction | Vanilla JavaScript — a single weighted sum over exported coefficients |
| Model training | Python 3 · scikit-learn · pandas · numpy · matplotlib |
| Hosting | GitHub Pages (free static hosting, auto-deployed on push) |

## Getting started

**Requirements**

- A modern browser with WebGL enabled (Chrome, Firefox, Safari, Edge)
- Python 3.9+ — only needed to serve the site locally or regenerate the model files

**Run locally**

```bash
git clone https://github.com/abhiramgangadharan07-crypto/ev-battery-health-site.git
cd ev-battery-health-site
python -m http.server 8000
# open http://127.0.0.1:8000
```

> A plain `file://` double-click won't work — browsers block `fetch` on local files for security.

## Project structure

```
ev-battery-health-site/
├── index.html              # the site itself
├── css/style.css           # paper & forest-green editorial theme
├── js/
│   ├── app.js              # prediction math, sliders, health verdicts, scroll reveals
│   └── scene.js            # the three 3D scenes: car, battery fill, point cloud
├── assets/
│   ├── model.json          # trained model — intercept, coefficients, ranges, metrics
│   ├── points.json         # the 2,000 samples, exported for the 3D point cloud
│   ├── ferrari.glb         # 3D car model (three.js examples, MIT) — Draco-compressed
│   ├── vendor/draco/       # vendored Draco decoder (three.js r128, local — no CDN needed)
│   ├── result_plot.png     # evaluation plot (actual vs predicted)
│   └── screenshot.png      # full-page preview used in this README
├── export_model.py         # re-exports model.json from the dataset
├── crosscheck.py           # proves browser formula == sklearn (diff ~1e-14)
├── README.md
└── LICENSE
```

## Regenerating the model data

`model.json` and `points.json` are generated from the companion repository [`ev-battery-health-prediction`](https://github.com/abhiramgangadharan07-crypto/ev-battery-health-prediction) (same pipeline, same `random_state=42`):

```bash
python export_model.py      # rebuilds model.json + points.json
python crosscheck.py         # prints MAX DIFFERENCE < 1e-9 if everything matches
```

## Deployment

The site is hosted on **GitHub Pages** and rebuilds automatically whenever `main` is pushed:

```bash
gh repo create ev-battery-health-site --public --source=. --push
gh api repos/abhiramgangadharan07-crypto/ev-battery-health-site/pages -X POST \
  -f "source[branch]=main" -f "source[path]=/"
```

The live site is at **https://abhiramgangadharan07-crypto.github.io/ev-battery-health-site/**.

## Troubleshooting

| Symptom | Cause & fix |
| ------- | ----------- |
| "The 3D car preview could not load." | Your browser has WebGL disabled, or an old cache from before the Draco fix. Enable WebGL (browser settings → hardware acceleration), or hard-refresh with Ctrl+F5 / Cmd+Shift+R. |
| Page loads but 3D scenes are blank | WebGL blocked in the browser. Check `chrome://gpu` (Chrome) or `about:support` (Firefox) for WebGL status. |
| Sliders don't move / verdict stays "Checking…" | JavaScript is disabled or a script failed. Open the console (F12) — a CDN script (`three.js`, `GLTFLoader`, `OrbitControls`) can be blocked by a proxy or ad-blocker; allow it for this site. |
| Downloading the repo then opening `index.html` shows nothing | `fetch()` on `file://` is blocked by browsers — serve via `python -m http.server 8000` instead. |
| Why is the prediction ±1 percentage point, not perfect? | SoH depends on many factors; a linear model captures the dominant linear trend but cannot model cell-to-cell manufacturing variation. R² 0.9967 on this structured dataset is excellent for a regression baseline. |

## Author

<div align="center">

**Abhiram Gangadharan** — B.Tech Electronics & Communication Engineering, Sree Buddha College of Engineering

[![GitHub](https://img.shields.io/badge/GitHub-abhiramgangadharan07--crypto-1C3A2E?style=for-the-badge&logo=github)](https://github.com/abhiramgangadharan07-crypto)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-abhiram--gangadharan-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/abhiram-gangadharan-a6282a379)
[![Kaggle](https://img.shields.io/badge/Kaggle-abhiramgangadharan07-20BEFF?style=for-the-badge&logo=kaggle)](https://www.kaggle.com/abhiramgangadharan07)
[![Email](https://img.shields.io/badge/Email-abhiramgangadharan07@gmail.com-D95D3F?style=for-the-badge&logo=gmail)](mailto:abhiramgangadharan07@gmail.com)

</div>

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

## Credits

- **Dataset:** *Battery State of Health Dataset* by [freshersstaff](https://www.kaggle.com/datasets/freshersstaff/battery-state-of-health-dataset) (Kaggle, CC-BY-4.0 for the original research dataset — see the companion project for the offline-dataset note)
- **Model & methodology:** [EV Battery Health Prediction](https://github.com/abhiramgangadharan07-crypto/ev-battery-health-prediction) (Linear Regression via scikit-learn)
- **3D:** [Three.js](https://threejs.org/) (MIT); `ferrari.glb` from the [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf) (MIT); Draco decoder vendored from the three.js examples (MIT)
- **Fonts:** Fraunces, Space Mono, Hanken Grotesk (Google Fonts, SIL OFL)