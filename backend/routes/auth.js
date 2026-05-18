const express     = require('express');
const router      = express.Router();
const authService = require('../services/authService');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      password,
      location_preference,
      alert_preference,
      risk_threshold
    } = req.body;

    // Validate required fields
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error:   'Name, email, phone and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate phone — 10 digits
    const phoneRegex = /^[0-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Indian phone number'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    const result = await authService.register({
      full_name,
      email,
      phone,
      password,
      location_preference,
      alert_preference,
      risk_threshold
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      ...result
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      error:   err.message
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error:   'Email and password are required'
      });
    }

    const result = await authService.login({ email, password });

    res.json({
      success: true,
      message: 'Login successful',
      ...result
    });

  } catch (err) {
    res.status(401).json({
      success: false,
      error:   err.message
    });
  }
});

// GET /api/auth/me — get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user:    req.user
  });
});

// PUT /api/auth/preferences — update alert preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const {
      location_preference,
      alert_preference,
      risk_threshold
    } = req.body;

    const supabase = require('../services/supabaseClient');

    const { data, error } = await supabase
      .from('users')
      .update({
        location_preference,
        alert_preference,
        risk_threshold
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      message: 'Preferences updated',
      user:    data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error:   err.message
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  const supabase = require('../services/supabaseClient');
  const token    = req.headers.authorization.split(' ')[1];

  await supabase
    .from('sessions')
    .delete()
    .eq('token', token);

  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;