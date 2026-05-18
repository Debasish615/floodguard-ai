const axios = require('axios');
require('dotenv').config();

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function checkHealth() {
  const res = await axios.get(`${ML_URL}/health`);
  return res.data;
}

async function predictCombined(current, history) {
  const res = await axios.post(`${ML_URL}/predict/combined`, {
    current,
    history
  });
  return res.data.result;
}

async function predictRF(current) {
  const res = await axios.post(`${ML_URL}/predict/rf`, current);
  return res.data.result;
}

module.exports = { checkHealth, predictCombined, predictRF };