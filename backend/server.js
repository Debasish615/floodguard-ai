require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const axios   = require('axios');
const authRouter = require('./routes/auth');

const { predictCombined } = require('./services/mlClient');
const { sendFloodAlert }  = require('./services/alertService');
const supabase            = require('./services/supabaseClient');
const predictionsRouter   = require('./routes/predictions');
const alertsRouter        = require('./routes/alerts');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS manual middleware (no cors package needed) ────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.use(express.json());

// ── Routes ─────────────────────────────────────────────────
app.use('/api/predictions', predictionsRouter);
app.use('/api/alerts',      alertsRouter);
app.use('/api/auth', authRouter);

app.get('/', (req, res) => {
  res.json({
    service:   'FloodGuard AI — Backend',
    status:    'running',
    version:   '1.0.0',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/predictions',
      'GET  /api/predictions/latest',
      'POST /api/predictions/predict',
      'GET  /api/alerts'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Locations ──────────────────────────────────────────────
const LOCATIONS = [
  // Odisha
  { name: 'Sambalpur',    lat: 21.47, lon: 83.97 },
  { name: 'Bhubaneswar', lat: 20.30, lon: 85.84 },
  { name: 'Cuttack',     lat: 20.46, lon: 85.88 },
  { name: 'Puri',        lat: 19.81, lon: 85.83 },
  { name: 'Balasore',    lat: 21.49, lon: 86.93 },

  // Arunachal Pradesh
  { name: 'Itanagar',    lat: 27.08, lon: 93.60 },
  { name: 'Pasighat',    lat: 28.06, lon: 95.32 },
  { name: 'Naharlagun',  lat: 27.10, lon: 93.69 },

  // Uttarakhand
  { name: 'Haridwar',    lat: 29.94, lon: 78.16 },
  { name: 'Dehradun',    lat: 30.32, lon: 78.03 },
  { name: 'Rishikesh',   lat: 30.09, lon: 78.27 },
  { name: 'Roorkee',     lat: 29.87, lon: 77.89 },

  // Assam
  { name: 'Guwahati',    lat: 26.14, lon: 91.74 },
  { name: 'Dibrugarh',   lat: 27.47, lon: 94.91 },
  { name: 'Silchar',     lat: 24.82, lon: 92.79 },

  // Bihar
  { name: 'Patna',       lat: 25.59, lon: 85.13 },
  { name: 'Darbhanga',   lat: 26.15, lon: 85.89 },
  { name: 'Muzaffarpur', lat: 26.12, lon: 85.36 },

  // West Bengal
  { name: 'Kolkata',     lat: 22.57, lon: 88.36 },
  { name: 'Malda',       lat: 25.00, lon: 88.14 },

  // Kerala
  { name: 'Kochi',       lat: 9.93,  lon: 76.26 },
  { name: 'Thrissur',    lat: 10.52, lon: 76.21 },

  // Himachal Pradesh
  { name: 'Mandi',       lat: 31.71, lon: 76.93 },
  { name: 'Kullu',       lat: 31.95, lon: 77.11 },
];

// ── Auto predict ───────────────────────────────────────────
async function autoPredict() {
  console.log(`\n[AutoPredict] Running at ${new Date().toLocaleTimeString('en-IN')}`);

  for (const loc of LOCATIONS) {
    try {
      const weatherRes = await axios.get(
        'https://api.open-meteo.com/v1/forecast', {
          params: {
            latitude:      loc.lat,
            longitude:     loc.lon,
            hourly:        'precipitation,temperature_2m,relativehumidity_2m,windspeed_10m',
            daily:         'precipitation_sum',
            timezone:      'Asia/Kolkata',
            forecast_days: 1
          }
        }
      );

      const hour   = new Date().getHours();
      const hourly = weatherRes.data.hourly;
      const daily  = weatherRes.data.daily;

      const current = {
        rainfall_mm:        hourly.precipitation[hour]       || 0,
        temperature_c:      hourly.temperature_2m[hour]      || 30,
        humidity_pct:       hourly.relativehumidity_2m[hour] || 70,
        wind_speed_kmh:     hourly.windspeed_10m[hour]       || 10,
        river_level_m:      (hourly.precipitation[hour] * 0.3) + 3,
        cumulative_rain_7d: daily.precipitation_sum[0]       || 0
      };

      const { data: history } = await supabase
        .from('weather_readings')
        .select('*')
        .eq('location_name', loc.name)
        .order('created_at', { ascending: false })
        .limit(10);

      const historyFormatted = (history || []).map(h => ({
        rainfall_mm:        h.rainfall_mm        || 0,
        temperature_c:      h.temperature_c      || 30,
        humidity_pct:       h.humidity_pct       || 70,
        wind_speed_kmh:     h.wind_speed_kmh     || 10,
        river_level_m:      h.river_level_m      || 3,
        cumulative_rain_7d: h.cumulative_rain_7d || 0
      })).reverse();

      const result = await predictCombined(
        current,
        historyFormatted.length > 0 ? historyFormatted : [current]
      );

      const { error: insertError } = await supabase
        .from('predictions')
        .insert({
          location_name:    loc.name,
          latitude:         loc.lat,
          longitude:        loc.lon,
          ...current,
          flood_predicted:  result.flood,
          probability:      result.probability,
          risk_label:       result.risk_label,
          rf_probability:   result.random_forest?.probability,
          lstm_probability: result.lstm?.probability
        });

      if (insertError) {
        console.error(`[AutoPredict] Save failed for ${loc.name}:`, insertError.message);
      } else {
        console.log(
          `[AutoPredict] ${loc.name} — ` +
          `Risk: ${result.risk_label} ` +
          `(${(result.probability * 100).toFixed(1)}%) — Saved ✓`
        );
      }

      if (['HIGH', 'SEVERE'].includes(result.risk_label)) {
        await sendFloodAlert(loc.name, result.risk_label, result.probability);
      }

    } catch (err) {
      console.error(`[AutoPredict] ${loc.name} failed:`, err.message);
    }
  }

  console.log('[AutoPredict] Done\n');
}

// ── Start server ───────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n✓ FloodGuard Backend running on port ${PORT}`);
  console.log(`✓ Visit:        http://localhost:${PORT}`);
  console.log(`✓ Predictions:  http://localhost:${PORT}/api/predictions/latest`);
  console.log(`✓ Alerts:       http://localhost:${PORT}/api/alerts`);

  console.log('\n[AutoPredict] Running initial prediction...');
  await autoPredict();

  cron.schedule('0 * * * *', autoPredict);
  console.log('✓ Scheduler active — runs every hour');
});