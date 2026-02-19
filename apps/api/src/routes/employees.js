'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../lib/database');
const { success, error, paginated } = require('../lib/response');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');

// ─── GET /employees ───────────────────────────────────────────────────────
router.get('/', authenticate, requireAdmin, (req, res) => {
  const { page = 1, limit = 20, q = '', role = '', active_only = 'false' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();

  let whereClause = '1=1';
  const params = [];

  if (q.trim()) {
    whereClause += ' AND (full_name LIKE ? OR username LIKE ? OR employee_code LIKE ?)';
    const s = `%${q.trim()}%`;
    params.push(s, s, s);
  }
  if (role) { whereClause += ' AND role = ?'; params.push(role); }
  if (active_only === 'true') { whereClause += ' AND is_active = 1'; }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE ${whereClause}`).get(...params).cnt;
  const employees = db.prepare(`
    SELECT id, employee_code, username, full_name, role, phone, email, is_active, last_login_at, created_at
    FROM users WHERE ${whereClause}
    ORDER BY full_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  return paginated(res, employees, total, page, limit);
});

// ─── GET /employees/:id ───────────────────────────────────────────────────
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const emp = db.prepare(`
    SELECT id, employee_code, username, full_name, role, phone, email, is_active, last_login_at, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!emp) return error(res, 'EMPLOYEE_NOT_FOUND', 'Employee not found.', 404);
  return success(res, emp);
});

// ─── POST /employees ──────────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { username, password, full_name, role = 'employee', phone, email } = req.body;

  if (!username || !password || !full_name) {
    return error(res, 'MISSING_FIELDS', 'Username, password, and full name are required.', 400);
  }
  if (password.length < 8) {
    return error(res, 'WEAK_PASSWORD', 'Password must be at least 8 characters long.', 400, 'password');
  }
  if (!['admin', 'employee'].includes(role)) {
    return error(res, 'INVALID_ROLE', 'Role must be either "admin" or "employee".', 400, 'role');
  }

  const db = getDb();

  // Check username uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (existing) {
    return error(res, 'USERNAME_EXISTS', 'This username is already taken. Please choose a different one.', 409, 'username');
  }

  // Generate employee code
  const lastCode = db.prepare('SELECT employee_code FROM users ORDER BY created_at DESC LIMIT 1').get();
  let nextNum = 3;
  if (lastCode) {
    const match = lastCode.employee_code.match(/EMP-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const employeeCode = `EMP-${String(nextNum).padStart(3, '0')}`;

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, employee_code, username, password_hash, full_name, role, phone, email, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, employeeCode, username.trim().toLowerCase(), passwordHash, full_name.trim(), role, phone || null, email || null, req.user.sub, now, now);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'EMPLOYEE_CREATED',
    entity: 'users',
    entityId: id,
    newData: { username, full_name, role, employee_code: employeeCode },
    ipAddress: req.ip,
  });

  const newEmp = db.prepare('SELECT id, employee_code, username, full_name, role, phone, email, is_active, created_at FROM users WHERE id = ?').get(id);
  return success(res, newEmp, 201);
});

// ─── PUT /employees/:id ───────────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return error(res, 'EMPLOYEE_NOT_FOUND', 'Employee not found.', 404);

  const { full_name, phone, email, role, is_active } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users SET full_name = ?, phone = ?, email = ?, role = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    full_name || existing.full_name,
    phone !== undefined ? phone : existing.phone,
    email !== undefined ? email : existing.email,
    role || existing.role,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    now,
    req.params.id
  );

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'EMPLOYEE_UPDATED',
    entity: 'users',
    entityId: req.params.id,
    oldData: { full_name: existing.full_name, role: existing.role, is_active: existing.is_active },
    newData: { full_name, role, is_active },
    ipAddress: req.ip,
  });

  const updated = db.prepare('SELECT id, employee_code, username, full_name, role, phone, email, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
  return success(res, updated);
});

// ─── POST /employees/:id/reset-password ───────────────────────────────────
router.post('/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return error(res, 'WEAK_PASSWORD', 'New password must be at least 8 characters long.', 400);
  }

  const db = getDb();
  const emp = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(req.params.id);
  if (!emp) return error(res, 'EMPLOYEE_NOT_FOUND', 'Employee not found.', 404);

  const newHash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(newHash, new Date().toISOString(), req.params.id);

  // Revoke all active sessions for this user
  db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE user_id = ? AND revoked_at IS NULL')
    .run(req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'PASSWORD_RESET',
    entity: 'users',
    entityId: req.params.id,
    ipAddress: req.ip,
  });

  return success(res, { message: 'Password reset successfully. All active sessions have been terminated.' });
});

// ─── DELETE /employees/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const emp = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!emp) return error(res, 'EMPLOYEE_NOT_FOUND', 'Employee not found.', 404);

  // Prevent deleting yourself
  if (emp.id === req.user.sub) {
    return error(res, 'CANNOT_DELETE_SELF', 'You cannot delete your own account.', 400);
  }

  // Soft disable instead of hard delete (preserve audit trail)
  db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), req.params.id);

  // Revoke all sessions
  db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE user_id = ? AND revoked_at IS NULL')
    .run(req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'EMPLOYEE_DISABLED',
    entity: 'users',
    entityId: req.params.id,
    oldData: { is_active: emp.is_active },
    ipAddress: req.ip,
  });

  return success(res, { message: 'Employee account disabled successfully.' });
});

module.exports = router;
