const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supabase = require('./supabaseClient');
require('dotenv').config();

const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ── Register new user ──────────────────────────────────────
async function register({
  full_name,
  email,
  phone,
  password,
  location_preference,
  alert_preference,
  risk_threshold
}) {
  // Check if email already exists
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingEmail) {
    throw new Error('Email already registered');
  }

  // Check if phone already exists
  const { data: existingPhone } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .single();

  if (existingPhone) {
    throw new Error('Phone number already registered');
  }

  // Hash password
  const salt          = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Save user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      full_name,
      email,
      phone,
      password_hash,
      location_preference: location_preference || 'all',
      alert_preference:    alert_preference    || 'both',
      risk_threshold:      risk_threshold      || 'HIGH',
      is_active:           true,
      is_verified:         true
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Generate token
  const token = generateToken(user);

  // Save session
  await saveSession(user.id, token);

  return {
    user:  sanitizeUser(user),
    token
  };
}

// ── Login ──────────────────────────────────────────────────
async function login({ email, password }) {
  // Find user
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new Error('Invalid email or password');
  }

  if (!user.is_active) {
    throw new Error('Account is deactivated');
  }

  // Check password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateToken(user);

  // Save session
  await saveSession(user.id, token);

  return {
    user:  sanitizeUser(user),
    token
  };
}

// ── Verify token ───────────────────────────────────────────
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (!user || !user.is_active) return null;
    return sanitizeUser(user);
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function saveSession(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await supabase.from('sessions').insert({
    user_id:    userId,
    token,
    expires_at: expiresAt.toISOString()
  });
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { register, login, verifyToken };