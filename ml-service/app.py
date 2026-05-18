from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

from predict import predict_random_forest, predict_lstm, predict_combined

app = FastAPI(
    title='FloodGuard AI — ML Service',
    description='Flood prediction API using Random Forest and LSTM',
    version='1.0.0'
)

# Allow Node.js backend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*']
)


# ── Request schemas ────────────────────────────────────────
class WeatherInput(BaseModel):
    rainfall_mm:       float
    temperature_c:     float
    humidity_pct:      float
    wind_speed_kmh:    float
    river_level_m:     float
    cumulative_rain_7d: float


class HistoryInput(BaseModel):
    current:  WeatherInput
    history:  List[WeatherInput]


# ── Routes ─────────────────────────────────────────────────
@app.get('/')
def root():
    return {
        'service': 'FloodGuard ML Service',
        'status':  'running',
        'models':  ['random_forest', 'lstm'],
        'endpoints': [
            '/predict/rf',
            '/predict/lstm',
            '/predict/combined',
            '/health'
        ]
    }


@app.get('/health')
def health():
    return { 'status': 'ok' }


@app.post('/predict/rf')
def predict_rf(data: WeatherInput):
    """Single point prediction using Random Forest."""
    try:
        result = predict_random_forest(data.dict())
        return {
            'success': True,
            'input':   data.dict(),
            'result':  result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict/lstm')
def predict_lstm_route(data: HistoryInput):
    """Time-series prediction using LSTM."""
    try:
        history = [h.dict() for h in data.history]
        result  = predict_lstm(history)
        return {
            'success': True,
            'result':  result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict/combined')
def predict_combined_route(data: HistoryInput):
    """
    Main endpoint — combined RF + LSTM prediction.
    Node.js backend calls this for flood risk scores.
    """
    try:
        current = data.current.dict()
        history = [h.dict() for h in data.history]
        result  = predict_combined(current, history)
        return {
            'success': True,
            'input':   current,
            'result':  result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == '__main__':
    uvicorn.run('app:app', host='0.0.0.0', port=8000, reload=True)