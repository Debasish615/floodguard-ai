import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)
from sklearn.preprocessing import StandardScaler
import pickle
import os

os.makedirs('models/saved', exist_ok=True)

# ── 1. Load data ──────────────────────────────────────────
print("Loading dataset...")
df = pd.read_csv('data/flood_data.csv')
print(f"✓ Loaded {len(df)} rows")
print(f"  Columns: {list(df.columns)}")
print(f"  Flood distribution:\n{df['flood'].value_counts()}\n")

# ── 2. Features & target ──────────────────────────────────
FEATURES = [
    'rainfall_mm',
    'temperature_c',
    'humidity_pct',
    'wind_speed_kmh',
    'river_level_m',
    'cumulative_rain_7d'
]

X = df[FEATURES]
y = df['flood']

# ── 3. Split ──────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"✓ Train size : {len(X_train)} rows")
print(f"✓ Test size  : {len(X_test)} rows\n")

# ── 4. Scale ──────────────────────────────────────────────
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ── 5. Train Random Forest ────────────────────────────────
print("Training Random Forest...")
rf_model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    class_weight='balanced'
)
rf_model.fit(X_train_scaled, y_train)
print("✓ Training complete\n")

# ── 6. Evaluate ───────────────────────────────────────────
y_pred = rf_model.predict(X_test_scaled)

accuracy = accuracy_score(y_test, y_pred)
print(f"── Model Performance ──────────────────")
print(f"  Accuracy : {accuracy * 100:.2f}%")
print(f"\n  Classification Report:")
print(classification_report(y_test, y_pred,
      target_names=['No Flood', 'Flood']))
print(f"  Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# ── 7. Feature importance ─────────────────────────────────
print(f"\n── Feature Importance ─────────────────")
importances = rf_model.feature_importances_
for feat, imp in sorted(
    zip(FEATURES, importances),
    key=lambda x: x[1],
    reverse=True
):
    bar = '█' * int(imp * 50)
    print(f"  {feat:<22} {bar} {imp:.4f}")

# ── 8. Save model & scaler ────────────────────────────────
print(f"\nSaving model...")
with open('models/saved/rf_model.pkl', 'wb') as f:
    pickle.dump(rf_model, f)

with open('models/saved/scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)

print("✓ Saved models/saved/rf_model.pkl")
print("✓ Saved models/saved/scaler.pkl")
print("\n✓ Random Forest training complete!")