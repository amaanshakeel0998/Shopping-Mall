'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../lib/database');
const { success, error } = require('../lib/response');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');

// ─── GET /categories ──────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();
  return success(res, categories);
});

// ─── POST /categories ─────────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, parent_id, sort_order } = req.body;
  if (!name) return error(res, 'MISSING_FIELDS', 'Category name is required.', 400);

  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (existing) return error(res, 'CATEGORY_EXISTS', 'A category with this name already exists.', 409);

  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), parent_id || null, sort_order || 0);

  auditLog({ actorId: req.user.sub, actorName: req.user.full_name, action: 'CATEGORY_CREATED', entity: 'categories', entityId: id, newData: { name }, ipAddress: req.ip });
  return success(res, db.prepare('SELECT * FROM categories WHERE id = ?').get(id), 201);
});

// ─── PUT /categories/:id ──────────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, sort_order, is_active } = req.body;
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return error(res, 'CATEGORY_NOT_FOUND', 'Category not found.', 404);

  db.prepare('UPDATE categories SET name = ?, sort_order = ?, is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(name || cat.name, sort_order !== undefined ? sort_order : cat.sort_order, is_active !== undefined ? (is_active ? 1 : 0) : cat.is_active, req.params.id);

  return success(res, db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// ─── DELETE /categories/:id ───────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id = ? AND is_active = 1').get(req.params.id);
  if (productCount.cnt > 0) {
    return error(res, 'CATEGORY_HAS_PRODUCTS', `Cannot delete category with ${productCount.cnt} active products. Reassign products first.`, 400);
  }
  db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(req.params.id);
  return success(res, { message: 'Category deleted.' });
});

// ─── GET /tax-rates ───────────────────────────────────────────────────────
router.get('/tax-rates', authenticate, (req, res) => {
  const db = getDb();
  return success(res, db.prepare('SELECT * FROM tax_rates WHERE is_active = 1 ORDER BY rate_pct ASC').all());
});

// ─── POST /tax-rates ──────────────────────────────────────────────────────
router.post('/tax-rates', authenticate, requireAdmin, (req, res) => {
  const { name, rate_pct } = req.body;
  if (!name || rate_pct === undefined) return error(res, 'MISSING_FIELDS', 'Name and rate are required.', 400);
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO tax_rates (id, name, rate_pct) VALUES (?, ?, ?)').run(id, name, parseFloat(rate_pct));
  return success(res, db.prepare('SELECT * FROM tax_rates WHERE id = ?').get(id), 201);
});

// ─── GET /discounts ───────────────────────────────────────────────────────
router.get('/discounts', authenticate, (req, res) => {
  const db = getDb();
  return success(res, db.prepare('SELECT * FROM discounts WHERE is_active = 1 ORDER BY name ASC').all());
});

// ─── POST /discounts ──────────────────────────────────────────────────────
router.post('/discounts', authenticate, requireAdmin, (req, res) => {
  const { name, type, value, valid_from, valid_to } = req.body;
  if (!name || !type || value === undefined) return error(res, 'MISSING_FIELDS', 'Name, type, and value are required.', 400);
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO discounts (id, name, type, value, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, type, parseFloat(value), valid_from || null, valid_to || null);
  return success(res, db.prepare('SELECT * FROM discounts WHERE id = ?').get(id), 201);
});

// ─── GET /counters ────────────────────────────────────────────────────────
router.get('/counters', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  return success(res, db.prepare('SELECT * FROM counters ORDER BY counter_number ASC').all());
});

// ─── POST /counters ───────────────────────────────────────────────────────
router.post('/counters', authenticate, requireAdmin, (req, res) => {
  const { counter_number, location } = req.body;
  if (!counter_number) return error(res, 'MISSING_FIELDS', 'Counter number is required.', 400);
  const db = getDb();
  const existing = db.prepare('SELECT id FROM counters WHERE counter_number = ?').get(counter_number);
  if (existing) return error(res, 'COUNTER_EXISTS', 'Counter number already exists.', 409);
  const id = uuidv4();
  db.prepare('INSERT INTO counters (id, counter_number, location) VALUES (?, ?, ?)').run(id, counter_number, location || null);
  return success(res, db.prepare('SELECT * FROM counters WHERE id = ?').get(id), 201);
});

// ─── POST /sync/heartbeat ─────────────────────────────────────────────────
router.post('/sync/heartbeat', authenticate, (req, res) => {
  const { counter_id } = req.body;
  if (counter_id) {
    const db = getDb();
    db.prepare('UPDATE counters SET last_seen_at = datetime(\'now\') WHERE id = ?').run(counter_id);
  }
  return success(res, { status: 'ok', server_time: new Date().toISOString() });
});

module.exports = router;
