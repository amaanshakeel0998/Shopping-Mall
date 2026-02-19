'use strict';

const jwt = require('jsonwebtoken');
const { getDb } = require('../lib/database');
const { error } = require('../lib/response');

/**
 * Verify JWT token and attach user to request.
 * Checks token blacklist (revoked sessions) on every request.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'UNAUTHORIZED', 'Authentication required. Please log in.', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Check if session has been revoked
    const db = getDb();
    const session = db.prepare(
      'SELECT id, revoked_at FROM sessions WHERE token_jti = ?'
    ).get(payload.jti);

    if (!session) {
      return error(res, 'SESSION_NOT_FOUND', 'Session not found. Please log in again.', 401);
    }
    if (session.revoked_at) {
      return error(res, 'SESSION_REVOKED', 'Your session has been terminated. Please log in again.', 401);
    }

    // Check if session is expired
    const sessionExpiry = db.prepare(
      'SELECT expires_at FROM sessions WHERE token_jti = ?'
    ).get(payload.jti);
    if (sessionExpiry && new Date(sessionExpiry.expires_at) < new Date()) {
      return error(res, 'SESSION_EXPIRED', 'Your session has timed out for security. Please log in again.', 401);
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'TOKEN_EXPIRED', 'Your session has timed out for security. Please log in again.', 401);
    }
    return error(res, 'INVALID_TOKEN', 'Invalid authentication token. Please log in again.', 401);
  }
}

/**
 * Require admin role. Must be used after authenticate().
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return error(res, 'FORBIDDEN', 'This action requires administrator access.', 403);
  }
  next();
}

/**
 * Require employee or admin role.
 */
function requireEmployee(req, res, next) {
  if (!req.user || !['admin', 'employee'].includes(req.user.role)) {
    return error(res, 'FORBIDDEN', 'Access denied.', 403);
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireEmployee };
