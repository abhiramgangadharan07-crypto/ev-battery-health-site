"""Export the trained linear regression model as JSON for the static website.

Reproduces the exact pipeline from analysis.ipynb (same features, same
random_state=42 split) and writes:
  assets/model.json  - intercept, coefficients, metrics, feature ranges
  assets/points.json - the 2000 samples (cycle, temperature, soh) for the 3D cloud
"""
import json
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(
    os.path.dirname(BASE), "ev-battery-health-prediction", "data"
)

csv_files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith(".csv")]
if not csv_files:
    raise FileNotFoundError("No dataset CSV found in ../ev-battery-health-prediction/data")
df = pd.read_csv(os.path.join(DATA_DIR, csv_files[0]))

# --- Same auto-detection as the notebook -----------------------------------
normalised = {c: c.lower().replace(" ", "").replace("_", "") for c in df.columns}
target_column = [c for c, n in normalised.items() if "soh" in n][0]
id_like = [
    c for c in df.columns
    if c.lower().replace("_", "")
    in ("batteryid", "batchid", "id", "index", "vpn", "vpnkey", "cellid", "evid")
]
df_clean = df.dropna()

y = df_clean[target_column]
features_raw = df_clean.drop(columns=[target_column] + id_like)
text_features = [
    c for c in features_raw.columns
    if pd.api.types.is_string_dtype(features_raw[c])
]
high_card = [c for c in text_features if features_raw[c].nunique() > 20]
if high_card:
    features_raw = features_raw.drop(columns=high_card)
numeric_features = features_raw.select_dtypes(include=[np.number]).columns.tolist()
object_features = [
    c for c in features_raw.columns
    if pd.api.types.is_string_dtype(features_raw[c])
]
if object_features:
    encoded = pd.get_dummies(features_raw[object_features], drop_first=True)
    X = pd.concat([features_raw[numeric_features], encoded], axis=1)
else:
    X = features_raw[numeric_features]
y = y.astype(float)

# --- Train exactly like the notebook ----------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
model = LinearRegression().fit(X_train, y_train)
y_pred = model.predict(X_test)
r2 = float(r2_score(y_test, y_pred))
rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

features = X.columns.tolist()
ranges = {
    f: {
        "min": float(df_clean[f].min()),
        "max": float(df_clean[f].max()),
        "mean": float(df_clean[f].mean()),
    }
    for f in features
}

points = [
    [round(float(r[0]), 3), round(float(r[1]), 3), round(float(r[2]), 3)]
    for r in zip(df_clean["Cycle"], df_clean["Temperature"], df_clean[target_column])
]

payload = {
    "model": "LinearRegression",
    "intercept": float(model.intercept_),
    "coefficients": {f: float(c) for f, c in zip(features, model.coef_)},
    "feature_order": features,
    "metrics": {
        "r2": r2,
        "rmse": rmse,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "total_samples": int(len(df_clean)),
    },
    "feature_ranges": ranges,
}

assets = os.path.join(BASE, "assets")
with open(os.path.join(assets, "model.json"), "w") as f:
    json.dump(payload, f, indent=1)
with open(os.path.join(assets, "points.json"), "w") as f:
    json.dump(points, f)

print(f"R²   : {r2:.4f}")
print(f"RMSE : {rmse:.4f}")
print(f"Samples: {len(df_clean)}  -> train {len(X_train)} / test {len(X_test)}")
print("Exported assets/model.json and assets/points.json")
