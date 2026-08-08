"""Cross-check: the JS dot-product formula must match sklearn exactly."""
import json
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE), "ev-battery-health-prediction", "data")
df = pd.read_csv(os.path.join(DATA_DIR, "EV_Battery_Data.csv"))

features = ["Cycle", "Voltage", "Current", "Temperature", "ChargeTime",
            "DischargeTime", "InternalResistance", "Capacity", "AmbientHumidity", "C_Rate"]
X = df[features]
y = df["SOH"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = LinearRegression().fit(X_train, y_train)

with open(os.path.join(BASE, "assets", "model.json")) as f:
    payload = json.load(f)

def js_predict(row):
    soh = payload["intercept"]
    for feat in payload["feature_order"]:
        soh += payload["coefficients"][feat] * float(row[feat])
    return soh

max_err = 0.0
for i in range(5):
    row = X_test.iloc[i]
    truth = float(y_test.iloc[i])
    py = float(model.predict([row])[0])
    js = js_predict(row)
    err = abs(py - js)
    max_err = max(max_err, err)
    print(f"row {i}: sklearn={py:.6f}  js-formula={js:.6f}  diff={err:.2e}  true_soh={truth:.2f}")

print(f"\nMAX DIFFERENCE: {max_err:.2e}  -> JS formula {'MATCHES' if max_err < 1e-9 else 'MISMATCH'}")
