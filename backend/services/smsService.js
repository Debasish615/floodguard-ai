const axios = require('axios');
require('dotenv').config();

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;

async function sendSMS(phoneNumber, message) {
  try {
    const response = await axios({
      method: 'GET',
      url:    'https://www.fast2sms.com/dev/bulkV2',
      params: {
        authorization: FAST2SMS_KEY,
        message:       message,
        language:      'english',
        route:         'v3',
        numbers:       phoneNumber
      }
    });

    if (response.data.return === true) {
      console.log(`[SMS] Sent to ${phoneNumber} ✓`);
      return true;
    } else {
      console.error(`[SMS] Failed:`, JSON.stringify(response.data));
      return false;
    }
  } catch (err) {
    console.error(`[SMS] Error:`, err.response?.data || err.message);
    return false;
  }
}

async function sendFloodSMSAlert(phoneNumber, locationName, riskLabel, probability) {
  const message =
    `FloodGuard AI Alert! ` +
    `Location: ${locationName} | ` +
    `Risk: ${riskLabel} | ` +
    `Probability: ${(probability * 100).toFixed(1)}% | ` +
    `Please move to safety immediately.`;

  return await sendSMS(phoneNumber, message);
}

module.exports = { sendSMS, sendFloodSMSAlert };