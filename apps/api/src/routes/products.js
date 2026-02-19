'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../lib/database');
const { success, error, paginated } = require('../lib/response');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');

// Helper: format product for API response (convert paise to display)
function formatProduct(p) {
  if (!p) return null;
  return {
    ...p,
    price: p.price_paise / 100,
    attributes: p.attributes ? JSON.parse(p.attributes) : {},
    is_active: p.is_active === 1,
  };
}

// ─── GET /products/scan/:barcode ──────────────────────────────────────────
// PRIMARY endpoint — called on every barcode scan. Must be sub-5ms.
router.get('/scan/:barcode', authenticate, (req, res) => {
  const { barcode } = req.params;
  if (!barcode || barcode.trim() === '') {
    return error(res, 'INVALID_BARCODE', 'Barcode cannot be empty.', 400);
  }

  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name,
           d.type as discount_type, d.value as discount_value, d.name as discount_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
    LEFT JOIN discounts d ON p.discount_id = d.id
      AND (d.valid_from IS NULL OR d.valid_from <= datetime('now'))
      AND (d.valid_to IS NULL OR d.valid_to >= datetime('now'))
      AND d.is_active = 1
    WHERE p.barcode = ? AND p.is_active = 1
  `).get(barcode.trim());

  if (!product) {
    return error(res, 'PRODUCT_NOT_FOUND',
      'Barcode not recognized. Try scanning again or search manually (press F1).', 404);
  }

  return success(res, formatProduct(product));
});

// ─── GET /products/search ─────────────────────────────────────────────────
router.get('/search', authenticate, (req, res) => {
  const { q = '', category = '', page = 1, limit = 20, active_only = 'true' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const db = getDb();
  let whereClause = '1=1';
  const params = [];

  if (active_only === 'true') {
    whereClause += ' AND p.is_active = 1';
  }
  if (q.trim()) {
    whereClause += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)';
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as cnt FROM products p WHERE ${whereClause}
  `).get(...params).cnt;

  const products = db.prepare(`
    SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
    WHERE ${whereClause}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  return paginated(res, products.map(formatProduct), total, page, limit);
});

// ─── GET /products/sync ───────────────────────────────────────────────────
// Returns products changed since a given timestamp (for counter sync)
router.get('/sync', authenticate, (req, res) => {
  const { since } = req.query;
  const db = getDb();

  let products;
  if (since) {
    products = db.prepare(`
      SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name,
             d.type as discount_type, d.value as discount_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
      LEFT JOIN discounts d ON p.discount_id = d.id AND d.is_active = 1
      WHERE p.updated_at > ?
      ORDER BY p.updated_at ASC
      LIMIT 1000
    `).all(since);
  } else {
    products = db.prepare(`
      SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name,
             d.type as discount_type, d.value as discount_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
      LEFT JOIN discounts d ON p.discount_id = d.id AND d.is_active = 1
      WHERE p.is_active = 1
      ORDER BY p.updated_at ASC
    `).all();
  }

  return success(res, {
    products: products.map(formatProduct),
    sync_timestamp: new Date().toISOString(),
    count: products.length,
  });
});

// ─── GET /products/:id ────────────────────────────────────────────────────
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name,
           d.type as discount_type, d.value as discount_value, d.name as discount_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
    LEFT JOIN discounts d ON p.discount_id = d.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    return error(res, 'PRODUCT_NOT_FOUND', 'Product not found.', 404);
  }

  return success(res, formatProduct(product));
});

// ─── GET /products ────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const { page = 1, limit = 50, category = '', active_only = 'true', q = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const db = getDb();
  let whereClause = '1=1';
  const params = [];

  if (active_only === 'true') {
    whereClause += ' AND p.is_active = 1';
  }
  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }
  if (q.trim()) {
    whereClause += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)';
    const s = `%${q.trim()}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM products p WHERE ${whereClause}`).get(...params).cnt;
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, t.rate_pct as tax_rate_pct, t.name as tax_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
    WHERE ${whereClause}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  return paginated(res, products.map(formatProduct), total, page, limit);
});

// ─── POST /products ───────────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { barcode, sku, name, description, category_id, price, tax_rate_id, discount_id, stock_quantity, unit, attributes } = req.body;

  if (!barcode || !sku || !name || !category_id || price === undefined) {
    return error(res, 'MISSING_FIELDS', 'Barcode, SKU, name, category, and price are required.', 400);
  }
  if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    return error(res, 'INVALID_PRICE', 'Price must be a valid positive number.', 400, 'price');
  }

  const db = getDb();

  // Check uniqueness
  const existingBarcode = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode.trim());
  if (existingBarcode) {
    return error(res, 'BARCODE_EXISTS', 'A product with this barcode already exists.', 409, 'barcode');
  }
  const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim());
  if (existingSku) {
    return error(res, 'SKU_EXISTS', 'A product with this SKU already exists.', 409, 'sku');
  }

  const id = uuidv4();
  const pricePaise = Math.round(parseFloat(price) * 100);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO products (id, barcode, sku, name, description, category_id, price_paise, tax_rate_id, discount_id, stock_quantity, unit, attributes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, barcode.trim(), sku.trim().toUpperCase(), name.trim(),
    description || null, category_id,
    pricePaise, tax_rate_id || null, discount_id || null,
    parseInt(stock_quantity) || 0,
    unit || 'piece',
    JSON.stringify(attributes || {}),
    now, now
  );

  const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'PRODUCT_CREATED',
    entity: 'products',
    entityId: id,
    newData: newProduct,
    ipAddress: req.ip,
  });

  return success(res, formatProduct(newProduct), 201);
});

// ─── PUT /products/:id ────────────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return error(res, 'PRODUCT_NOT_FOUND', 'Product not found.', 404);
  }

  const { barcode, sku, name, description, category_id, price, tax_rate_id, discount_id, stock_quantity, unit, attributes, is_active } = req.body;

  // Check barcode uniqueness (excluding self)
  if (barcode && barcode !== existing.barcode) {
    const dup = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
    if (dup) return error(res, 'BARCODE_EXISTS', 'A product with this barcode already exists.', 409, 'barcode');
  }

  const pricePaise = price !== undefined ? Math.round(parseFloat(price) * 100) : existing.price_paise;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products SET
      barcode = ?, sku = ?, name = ?, description = ?, category_id = ?,
      price_paise = ?, tax_rate_id = ?, discount_id = ?, stock_quantity = ?,
      unit = ?, attributes = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    barcode || existing.barcode,
    sku ? sku.trim().toUpperCase() : existing.sku,
    name || existing.name,
    description !== undefined ? description : existing.description,
    category_id || existing.category_id,
    pricePaise,
    tax_rate_id !== undefined ? tax_rate_id : existing.tax_rate_id,
    discount_id !== undefined ? discount_id : existing.discount_id,
    stock_quantity !== undefined ? parseInt(stock_quantity) : existing.stock_quantity,
    unit || existing.unit,
    attributes !== undefined ? JSON.stringify(attributes) : existing.attributes,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'PRODUCT_UPDATED',
    entity: 'products',
    entityId: req.params.id,
    oldData: existing,
    newData: updated,
    ipAddress: req.ip,
  });

  return success(res, formatProduct(updated));
});

// ─── PATCH /products/:id/stock ────────────────────────────────────────────
router.patch('/:id/stock', authenticate, requireAdmin, (req, res) => {
  const { adjustment, reason } = req.body;
  if (adjustment === undefined || isNaN(parseInt(adjustment))) {
    return error(res, 'INVALID_ADJUSTMENT', 'Stock adjustment value is required.', 400);
  }

  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return error(res, 'PRODUCT_NOT_FOUND', 'Product not found.', 404);

  const newQty = product.stock_quantity + parseInt(adjustment);
  db.prepare('UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?')
    .run(newQty, new Date().toISOString(), req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'STOCK_ADJUSTED',
    entity: 'products',
    entityId: req.params.id,
    oldData: { stock_quantity: product.stock_quantity },
    newData: { stock_quantity: newQty, adjustment, reason },
    ipAddress: req.ip,
  });

  return success(res, { id: req.params.id, old_quantity: product.stock_quantity, new_quantity: newQty, adjustment });
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return error(res, 'PRODUCT_NOT_FOUND', 'Product not found.', 404);

  // Soft delete
  db.prepare('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'PRODUCT_DELETED',
    entity: 'products',
    entityId: req.params.id,
    oldData: product,
    ipAddress: req.ip,
  });

  return success(res, { message: 'Product deactivated successfully.' });
});

module.exports = router;
