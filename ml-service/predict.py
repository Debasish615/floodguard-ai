import pickle
import numpy as np
from tensorflow.keras.models import load_model

# ── Load models once when server starts ───────────────────
print("Loading models...")

with open('models/saved/rf_model.pkl', 'rb') as f:
    rf_model = pickle.load(f)

with open('models/saved/scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)

lstm_model = load_model('models/saved/lstm_model.keras')

print("✓ All models loaded")

# ── Feature order must match training ─────────────────────
FEATURES = [
    'rainfall_mm',
    'temperature_c',
    'humidity_pct',
    'wind_speed_kmh',
    'river_level_m',
    'cumulative_rain_7d'
]

TIMESTEPS = 10


def get_risk_label(score: float) -> str:
    if score >= 0.75:
        return 'SEVERE'
    elif score >= 0.50:
        return 'HIGH'
    elif score >= 0.25:
        return 'MODERATE'
    else:
        return 'LOW'


def predict_random_forest(data: dict) -> dict:
    """Fast single-point prediction using Random Forest."""
    features = np.array([[data[f] for f in FEATURES]])
    scaled   = scaler.transform(features)

    prob      = rf_model.predict_proba(scaled)[0][1]
    predicted = int(prob >= 0.5)

    return {
        'model':       'random_forest',
        'flood':       predicted,
        'probability': round(float(prob), 4),
        'risk_label':  get_risk_label(prob)
    }


def predict_lstm(history: list[dict]) -> dict:
    """
    Time-series prediction using LSTM.
    history = list of last 10 weather readings (oldest first).
    """
    if len(history) < TIMESTEPS:
        # Pad with first reading if not enough history
        pad   = [history[0]] * (TIMESTEPS - len(history))
        history = pad + history

    # Build sequence array
    seq = np.array([[h[f] for f in FEATURES] for h in history[-TIMESTEPS:]])
    seq_scaled = scaler.transform(seq)

    # Reshape to (1, timesteps, features)
    X = seq_scaled.reshape(1, TIMESTEPS, len(FEATURES))

    prob      = float(lstm_model.predict(X, verbose=0)[0][0])
    predicted = int(prob >= 0.5)

    return {
        'model':       'lstm',
        'flood':       predicted,
        'probability': round(prob, 4),
        'risk_label':  get_risk_label(prob)
    }


def predict_combined(data: dict, history: list[dict]) -> dict:
    """
    Combined prediction — average of RF and LSTM.
    This is the main prediction used by the app.
    """
    rf_result   = predict_random_forest(data)
    lstm_result = predict_lstm(history)

    # Weighted average — LSTM gets more weight for time-series
    combined_prob = (
        rf_result['probability'] * 0.4 +
        lstm_result['probability'] * 0.6
    )
    combined_flood = int(combined_prob >= 0.5)

    return {
        'flood':            combined_flood,
        'probability':      round(combined_prob, 4),
        'risk_label':       get_risk_label(combined_prob),
        'random_forest':    rf_result,
        'lstm':             lstm_result,
    }