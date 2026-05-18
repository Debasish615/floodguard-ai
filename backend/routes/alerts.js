const express  = require('express');
const router   = express.Router();
const supabase = require('../services/supabaseClient');

// GET /api/alerts — get recent alerts
router.get('/', async (req, res) => {
  const { limit = 20 } = req.query;

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: data.length, data });
});

module.exports = router;