import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
import pickle
import os

os.makedirs('models/saved', exist_ok=True)

# ── 1. Load data ──────────────────────────────────────────
print("Loading dataset...")
df = pd.read_csv('data/flood_data.csv')
print(f"✓ Loaded {len(df)} rows\n")

FEATURES = [
    'rainfall_mm',
    'temperature_c',
    'humidity_pct',
    'wind_speed_kmh',
    'river_level_m',
    'cumulative_rain_7d'
]

X = df[FEATURES].values
y = df['flood'].values

# ── 2. Scale ──────────────────────────────────────────────
# Load same scaler used in Random Forest for consistency
with open('models/saved/scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

X_scaled = scaler.transform(X)

# ── 3. Create sequences for LSTM ──────────────────────────
# LSTM needs 3D input: (samples, timesteps, features)
# We use a window of 10 timesteps
TIMESTEPS = 10

def create_sequences(X, y, timesteps):
    Xs, ys = [], []
    for i in range(len(X) - timesteps):
        Xs.append(X[i:(i + timesteps)])
        ys.append(y[i + timesteps])
    return np.array(Xs), np.array(ys)

print("Creating sequences...")
X_seq, y_seq = create_sequences(X_scaled, y, TIMESTEPS)
print(f"✓ Sequence shape: {X_seq.shape}")
print(f"✓ Target shape  : {y_seq.shape}\n")

# ── 4. Train/test split ───────────────────────────────────
split = int(len(X_seq) * 0.8)
X_train, X_test = X_seq[:split], X_seq[split:]
y_train, y_test = y_seq[:split], y_seq[split:]

print(f"✓ Train size: {len(X_train)} sequences")
print(f"✓ Test size : {len(X_test)} sequences\n")

# ── 5. Build LSTM model ───────────────────────────────────
print("Building LSTM model...")
model = Sequential([
    LSTM(64, input_shape=(TIMESTEPS, len(FEATURES)),
         return_sequences=True),
    Dropout(0.2),
    LSTM(32, return_sequences=False),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(1, activation='sigmoid')
])

model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)

model.summary()

# ── 6. Train ──────────────────────────────────────────────
print("\nTraining LSTM...")
early_stop = EarlyStopping(
    monitor='val_loss',
    patience=5,
    restore_best_weights=True
)

history = model.fit(
    X_train, y_train,
    epochs=30,
    batch_size=32,
    validation_split=0.2,
    callbacks=[early_stop],
    verbose=1
)

# ── 7. Evaluate ───────────────────────────────────────────
print("\n── Model Performance ──────────────────")
y_pred_prob = model.predict(X_test)
y_pred = (y_pred_prob > 0.5).astype(int).flatten()

accuracy = accuracy_score(y_test, y_pred)
print(f"  Accuracy : {accuracy * 100:.2f}%")
print(f"\n  Classification Report:")
print(classification_report(y_test, y_pred,
      target_names=['No Flood', 'Flood']))

# ── 8. Save model ─────────────────────────────────────────
print("Saving LSTM model...")
model.save('models/saved/lstm_model.keras')
print("✓ Saved models/saved/lstm_model.keras")
print("\n✓ LSTM training complete!")