'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../lib/database');
const { success, error } = require('../lib/response');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');
const rateLimit = require('express-rate-limit');

// Rate limit login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please wait 15 minutes before trying again.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, (req, res) => {
  const { username, password, counter_id } = req.body;

  if (!username || !password) {
    return error(res, 'MISSING_FIELDS', 'Username and password are required.', 400);
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, password_hash, full_name, role, employee_code, is_active
    FROM users WHERE username = ?
  `).get(username.trim().toLowerCase());

  if (!user) {
    return error(res, 'INVALID_CREDENTIALS', 'Incorrect username or password.', 401);
  }

  if (!user.is_active) {
    return error(res, 'ACCOUNT_DISABLED', 'Your account has been disabled. Please contact the administrator.', 403);
  }

  const passwordMatch = bcrypt.compareSync(password, user.password_hash);
  if (!passwordMatch) {
    auditLog({
      actorId: user.id,
      actorName: user.full_name,
      action: 'LOGIN_FAILED',
      entity: 'users',
      entityId: user.id,
      ipAddress: req.ip,
    });
    return error(res, 'INVALID_CREDENTIALS', 'Incorrect username or password.', 401);
  }

  // Generate unique JWT ID for revocation support
  const jti = uuidv4();
  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES || '15m';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES || '8h';

  const tokenPayload = {
    sub: user.id,
    jti,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    employee_code: user.employee_code,
    counter_id: counter_id || null,
  };

  const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: accessExpiresIn });
  const refreshToken = jwt.sign({ sub: user.id, jti, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: refreshExpiresIn });

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours for session

  // Store session
  db.prepare(`
    INSERT INTO sessions (id, user_id, counter_id, token_jti, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), user.id, counter_id || null, jti, expiresAt.toISOString());

  // Update last login
  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

  // Update counter last seen
  if (counter_id) {
    db.prepare('UPDATE counters SET last_seen_at = datetime(\'now\') WHERE id = ?').run(counter_id);
  }

  auditLog({
    actorId: user.id,
    actorName: user.full_name,
    action: 'LOGIN_SUCCESS',
    entity: 'users',
    entityId: user.id,
    ipAddress: req.ip,
    counterId: counter_id,
  });

  return success(res, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: accessExpiresIn,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      employee_code: user.employee_code,
    },
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE sessions SET revoked_at = datetime('now') WHERE token_jti = ?
  `).run(req.user.jti);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'LOGOUT',
    entity: 'users',
    entityId: req.user.sub,
    ipAddress: req.ip,
    counterId: req.user.counter_id,
  });

  return success(res, { message: 'Logged out successfully.' });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return error(res, 'MISSING_TOKEN', 'Refresh token is required.', 400);
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      return error(res, 'INVALID_TOKEN', 'Invalid refresh token.', 401);
    }

    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE token_jti = ?').get(payload.jti);
    if (!session || session.revoked_at) {
      return error(res, 'SESSION_REVOKED', 'Session has been terminated. Please log in again.', 401);
    }

    const user = db.prepare('SELECT id, username, full_name, role, employee_code, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) {
      return error(res, 'ACCOUNT_DISABLED', 'Account is disabled.', 403);
    }

    // Issue new access token with same JTI (session continues)
    const newAccessToken = jwt.sign({
      sub: user.id,
      jti: payload.jti,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      employee_code: user.employee_code,
      counter_id: session.counter_id,
    }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });

    return success(res, { access_token: newAccessToken });
  } catch (err) {
    return error(res, 'INVALID_TOKEN', 'Invalid or expired refresh token. Please log in again.', 401);
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, employee_code, username, full_name, role, phone, email, last_login_at, created_at
    FROM users WHERE id = ?
  `).get(req.user.sub);

  if (!user) {
    return error(res, 'USER_NOT_FOUND', 'User not found.', 404);
  }

  return success(res, user);
});

module.exports = router;
