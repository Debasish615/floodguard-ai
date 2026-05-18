const express = require('express');
const router  = express.Router();
const supabase = require('../services/supabaseClient');
const { predictCombined } = require('../services/mlClient');
const { sendFloodAlert }  = require('../services/alertService');

// GET /api/predictions — get last 50 predictions
router.get('/', async (req, res) => {
  const { location, limit = 50 } = req.query;

  let query = supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (location) query = query.eq('location_name', location);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: data.length, data });
});

// GET /api/predictions/latest — latest prediction per location
router.get('/latest', async (req, res) => {
  try {
    // Get all unique location names first
    const { data: allPredictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });

    // Get latest prediction for each unique location
    const latestMap = {};
    allPredictions.forEach(p => {
      if (!latestMap[p.location_name]) {
        latestMap[p.location_name] = p;
      }
    });

    const results = Object.values(latestMap);

    res.json({
      success: true,
      count:   results.length,
      data:    results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predictions/predict — manual prediction
router.post('/predict', async (req, res) => {
  try {
    const {
      location_name,
      latitude,
      longitude,
      current,
      history
    } = req.body;

    if (!current) {
      return res.status(400).json({ error: 'current weather data required' });
    }

    // Call Python ML service
    const result = await predictCombined(
      current,
      history || [current]
    );

    // Save prediction to Supabase
    const record = {
      location_name,
      latitude,
      longitude,
      ...current,
      flood_predicted:  result.flood,
      probability:      result.probability,
      risk_label:       result.risk_label,
      rf_probability:   result.random_forest?.probability,
      lstm_probability: result.lstm?.probability
    };

    const { error } = await supabase
      .from('predictions')
      .insert(record);

    if (error) console.error('[Predictions] Save failed:', error.message);

    // Send alert if needed
    if (['MODERATE', 'HIGH', 'SEVERE'].includes(result.risk_label)) {
      await sendFloodAlert(
        location_name,
        result.risk_label,
        result.probability
      );
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;