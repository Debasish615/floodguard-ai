const nodemailer       = require('nodemailer');
const supabase         = require('./supabaseClient');
const { sendFloodSMSAlert } = require('./smsService');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function getAffectedUsers(locationName) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .or(`location_preference.eq.all,location_preference.eq.${locationName}`);

  if (error) {
    console.error('[Alert] Failed to get users:', error.message);
    return [];
  }
  return data || [];
}

async function sendEmailAlert(user, locationName, riskLabel, probability) {
  const subject = riskLabel === 'SEVERE'
    ? `🚨 SEVERE Flood Warning — ${locationName}`
    : `⚠️ HIGH Flood Alert — ${locationName}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:${riskLabel === 'SEVERE' ? '#B71C1C' : '#E53935'};
                  padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;">
          ${riskLabel === 'SEVERE' ? '🚨' : '⚠️'} Flood ${riskLabel} Alert
        </h1>
      </div>
      <div style="background:#f5f5f5;padding:24px;border-radius:0 0 8px 8px;">
        <p>Dear <strong>${user.full_name}</strong>,</p>
        <p>FloodGuard AI has detected a <strong>${riskLabel}</strong> 
           flood risk for <strong>${locationName}</strong>.</p>
        <div style="background:white;padding:16px;border-radius:8px;margin:16px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px;color:#666;">Location</td>
              <td style="padding:8px;font-weight:bold;">${locationName}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:8px;color:#666;">Risk Level</td>
              <td style="padding:8px;font-weight:bold;
                         color:${riskLabel === 'SEVERE' ? '#B71C1C' : '#E53935'};">
                ${riskLabel}
              </td>
            </tr>
            <tr>
              <td style="padding:8px;color:#666;">Probability</td>
              <td style="padding:8px;font-weight:bold;">
                ${(probability * 100).toFixed(1)}%
              </td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:8px;color:#666;">Time</td>
              <td style="padding:8px;">
                ${new Date().toLocaleString('en-IN')}
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#FFF3E0;padding:16px;border-radius:8px;
                    border-left:4px solid #FF9800;">
          <strong>⚠️ Immediate Precautions:</strong>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Move to higher ground immediately</li>
            <li>Avoid low-lying areas and river banks</li>
            <li>Keep emergency contacts ready</li>
            <li>Follow local authority instructions</li>
            <li>Do not walk or drive through flood waters</li>
          </ul>
        </div>
        <p style="color:#999;font-size:12px;margin-top:24px;">
          Sent by FloodGuard AI System — Silicon Institute of Technology
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from:    `"FloodGuard AI" <${process.env.EMAIL_USER}>`,
      to:      user.email,
      subject: subject,
      html:    html
    });
    console.log(`[Alert] Email sent to ${user.email} ✓`);
    return true;
  } catch (err) {
    console.error(`[Alert] Email failed for ${user.email}:`, err.message);
    return false;
  }
}

async function sendFloodAlert(locationName, riskLabel, probability) {
  try {
    // Save alert to Supabase
    await supabase.from('alerts').insert({
      location_name: locationName,
      risk_label:    riskLabel,
      probability:   probability,
      message:       `Flood ${riskLabel} alert for ${locationName}`,
      email_sent:    false
    });

    // Only notify on HIGH or SEVERE
    if (!['HIGH', 'SEVERE'].includes(riskLabel)) return;

    // Get affected users
    const users = await getAffectedUsers(locationName);
    if (users.length === 0) {
      console.log(`[Alert] No users for ${locationName}`);
      return;
    }

    console.log(`[Alert] Notifying ${users.length} users for ${locationName}...`);

    let emailCount = 0;
    let smsCount   = 0;

    for (const user of users) {
      const pref = user.alert_preference;

      // Send email
      if (pref === 'email' || pref === 'both') {
        const sent = await sendEmailAlert(user, locationName, riskLabel, probability);
        if (sent) emailCount++;
      }

      // Send SMS
      if (pref === 'sms' || pref === 'both') {
        const sent = await sendFloodSMSAlert(
          user.phone, locationName, riskLabel, probability
        );
        if (sent) smsCount++;
      }
    }

    // Update alert as sent
    await supabase
      .from('alerts')
      .update({ email_sent: true })
      .eq('location_name', locationName)
      .order('created_at', { ascending: false })
      .limit(1);

    console.log(
      `[Alert] Done — ${emailCount} emails + ${smsCount} SMS sent for ${locationName}`
    );

  } catch (err) {
    console.error('[Alert] sendFloodAlert failed:', err.message);
  }
}

module.exports = { sendFloodAlert };