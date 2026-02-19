'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/database');
const { success, error } = require('../lib/response');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── GET /reports/dashboard ───────────────────────────────────────────────
router.get('/dashboard', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const todaySales = db.prepare(`
    SELECT COUNT(*) as bill_count, COALESCE(SUM(total_paise), 0) as total_paise
    FROM bills WHERE DATE(billed_at) = ? AND status = 'paid'
  `).get(today);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthSales = db.prepare(`
    SELECT COUNT(*) as bill_count, COALESCE(SUM(total_paise), 0) as total_paise
    FROM bills WHERE billed_at >= ? AND status = 'paid'
  `).get(monthStart.toISOString());

  const totalProducts = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE is_active = 1').get();
  const totalEmployees = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1 AND role = \'employee\'').get();
  const lowStock = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE stock_quantity <= 5 AND is_active = 1').get();

  const recentBills = db.prepare(`
    SELECT b.invoice_number, b.total_paise, b.payment_method, b.billed_at,
           u.full_name as employee_name, c.counter_number
    FROM bills b
    LEFT JOIN users u ON b.employee_id = u.id
    LEFT JOIN counters c ON b.counter_id = c.id
    WHERE b.status = 'paid'
    ORDER BY b.billed_at DESC LIMIT 10
  `).all();

  const topProducts = db.prepare(`
    SELECT bi.product_name, SUM(bi.quantity) as total_qty, SUM(bi.line_total_paise) as total_revenue
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE b.status = 'paid' AND DATE(b.billed_at) = ?
    GROUP BY bi.product_id, bi.product_name
    ORDER BY total_revenue DESC LIMIT 5
  `).all(today);

  return success(res, {
    today: {
      bill_count: todaySales.bill_count,
      total: todaySales.total_paise / 100,
    },
    this_month: {
      bill_count: monthSales.bill_count,
      total: monthSales.total_paise / 100,
    },
    total_products: totalProducts.cnt,
    total_employees: totalEmployees.cnt,
    low_stock_count: lowStock.cnt,
    recent_bills: recentBills.map(b => ({ ...b, total: b.total_paise / 100 })),
    top_products_today: topProducts.map(p => ({ ...p, total_revenue: p.total_revenue / 100 })),
  });
});

// ─── GET /reports/sales ───────────────────────────────────────────────────
router.get('/sales', authenticate, requireAdmin, (req, res) => {
  const { from, to, counter_id, employee_id, group_by = 'day' } = req.query;
  const db = getDb();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  let whereClause = `b.status = 'paid' AND DATE(b.billed_at) BETWEEN ? AND ?`;
  const params = [fromDate, toDate];

  if (counter_id) { whereClause += ' AND b.counter_id = ?'; params.push(counter_id); }
  if (employee_id) { whereClause += ' AND b.employee_id = ?'; params.push(employee_id); }

  let groupExpr;
  if (group_by === 'month') groupExpr = "strftime('%Y-%m', b.billed_at)";
  else if (group_by === 'hour') groupExpr = "strftime('%Y-%m-%d %H:00', b.billed_at)";
  else groupExpr = "DATE(b.billed_at)";

  const salesData = db.prepare(`
    SELECT ${groupExpr} as period,
           COUNT(*) as bill_count,
           COALESCE(SUM(b.subtotal_paise), 0) as subtotal_paise,
           COALESCE(SUM(b.tax_paise), 0) as tax_paise,
           COALESCE(SUM(b.discount_paise), 0) as discount_paise,
           COALESCE(SUM(b.total_paise), 0) as total_paise,
           COALESCE(AVG(b.total_paise), 0) as avg_bill_paise
    FROM bills b
    WHERE ${whereClause}
    GROUP BY period
    ORDER BY period ASC
  `).all(...params);

  const summary = db.prepare(`
    SELECT COUNT(*) as total_bills,
           COALESCE(SUM(b.subtotal_paise), 0) as subtotal_paise,
           COALESCE(SUM(b.tax_paise), 0) as tax_paise,
           COALESCE(SUM(b.discount_paise), 0) as discount_paise,
           COALESCE(SUM(b.total_paise), 0) as total_paise,
           COALESCE(AVG(b.total_paise), 0) as avg_bill_paise
    FROM bills b WHERE ${whereClause}
  `).get(...params);

  const paymentBreakdown = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total_paise) as total_paise
    FROM bills b WHERE ${whereClause}
    GROUP BY payment_method
  `).all(...params);

  return success(res, {
    period: { from: fromDate, to: toDate },
    summary: {
      total_bills: summary.total_bills,
      subtotal: summary.subtotal_paise / 100,
      tax: summary.tax_paise / 100,
      discount: summary.discount_paise / 100,
      total: summary.total_paise / 100,
      avg_bill: summary.avg_bill_paise / 100,
    },
    data: salesData.map(d => ({
      period: d.period,
      bill_count: d.bill_count,
      subtotal: d.subtotal_paise / 100,
      tax: d.tax_paise / 100,
      discount: d.discount_paise / 100,
      total: d.total_paise / 100,
      avg_bill: d.avg_bill_paise / 100,
    })),
    payment_breakdown: paymentBreakdown.map(p => ({
      method: p.payment_method || 'cash',
      count: p.count,
      total: p.total_paise / 100,
    })),
  });
});

// ─── GET /reports/products ────────────────────────────────────────────────
router.get('/products', authenticate, requireAdmin, (req, res) => {
  const { from, to, category_id, limit = 50 } = req.query;
  const db = getDb();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  let whereClause = `b.status = 'paid' AND DATE(b.billed_at) BETWEEN ? AND ?`;
  const params = [fromDate, toDate];

  if (category_id) {
    whereClause += ' AND p.category_id = ?';
    params.push(category_id);
  }

  const products = db.prepare(`
    SELECT bi.product_id, bi.product_name, bi.barcode,
           p.sku, c.name as category_name,
           SUM(bi.quantity) as total_qty,
           SUM(bi.line_total_paise) as total_revenue_paise,
           COUNT(DISTINCT bi.bill_id) as bill_count,
           p.stock_quantity as current_stock
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereClause}
    GROUP BY bi.product_id, bi.product_name
    ORDER BY total_revenue_paise DESC
    LIMIT ?
  `).all(...params, parseInt(limit));

  return success(res, {
    period: { from: fromDate, to: toDate },
    products: products.map(p => ({
      ...p,
      total_revenue: p.total_revenue_paise / 100,
    })),
  });
});

// ─── GET /reports/employees ───────────────────────────────────────────────
router.get('/employees', authenticate, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const db = getDb();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  const employees = db.prepare(`
    SELECT u.id, u.employee_code, u.full_name, u.username,
           COUNT(b.id) as bill_count,
           COALESCE(SUM(b.total_paise), 0) as total_revenue_paise,
           COALESCE(AVG(b.total_paise), 0) as avg_bill_paise,
           MAX(b.billed_at) as last_bill_at
    FROM users u
    LEFT JOIN bills b ON u.id = b.employee_id
      AND b.status = 'paid'
      AND DATE(b.billed_at) BETWEEN ? AND ?
    WHERE u.role = 'employee'
    GROUP BY u.id
    ORDER BY total_revenue_paise DESC
  `).all(fromDate, toDate);

  return success(res, {
    period: { from: fromDate, to: toDate },
    employees: employees.map(e => ({
      ...e,
      total_revenue: e.total_revenue_paise / 100,
      avg_bill: e.avg_bill_paise / 100,
    })),
  });
});

// ─── GET /reports/tax ─────────────────────────────────────────────────────
router.get('/tax', authenticate, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const db = getDb();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  const taxByRate = db.prepare(`
    SELECT bi.tax_rate_pct,
           COUNT(DISTINCT b.id) as bill_count,
           SUM(bi.quantity) as total_qty,
           SUM(bi.unit_price_paise * bi.quantity) as taxable_amount_paise,
           SUM(ROUND(bi.unit_price_paise * bi.tax_rate_pct / 100) * bi.quantity) as tax_collected_paise
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE b.status = 'paid' AND DATE(b.billed_at) BETWEEN ? AND ?
    GROUP BY bi.tax_rate_pct
    ORDER BY bi.tax_rate_pct ASC
  `).all(fromDate, toDate);

  const totalTax = db.prepare(`
    SELECT COALESCE(SUM(tax_paise), 0) as total_tax_paise
    FROM bills WHERE status = 'paid' AND DATE(billed_at) BETWEEN ? AND ?
  `).get(fromDate, toDate);

  return success(res, {
    period: { from: fromDate, to: toDate },
    total_tax_collected: totalTax.total_tax_paise / 100,
    by_rate: taxByRate.map(t => ({
      tax_rate_pct: t.tax_rate_pct,
      bill_count: t.bill_count,
      total_qty: t.total_qty,
      taxable_amount: t.taxable_amount_paise / 100,
      tax_collected: t.tax_collected_paise / 100,
    })),
  });
});

// ─── GET /reports/inventory ───────────────────────────────────────────────
router.get('/inventory', authenticate, requireAdmin, (req, res) => {
  const { low_stock_only = 'false', category_id } = req.query;
  const db = getDb();

  let whereClause = 'p.is_active = 1';
  const params = [];

  if (low_stock_only === 'true') {
    whereClause += ' AND p.stock_quantity <= 10';
  }
  if (category_id) {
    whereClause += ' AND p.category_id = ?';
    params.push(category_id);
  }

  const products = db.prepare(`
    SELECT p.id, p.barcode, p.sku, p.name, p.stock_quantity, p.unit,
           p.price_paise, c.name as category_name,
           (SELECT COALESCE(SUM(bi.quantity), 0) FROM bill_items bi
            JOIN bills b ON bi.bill_id = b.id
            WHERE bi.product_id = p.id AND b.status = 'paid'
            AND DATE(b.billed_at) >= DATE('now', '-30 days')) as sold_last_30_days
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ${whereClause}
    ORDER BY p.stock_quantity ASC
  `).all(...params);

  return success(res, {
    products: products.map(p => ({
      ...p,
      price: p.price_paise / 100,
      stock_status: p.stock_quantity === 0 ? 'out_of_stock' : p.stock_quantity <= 5 ? 'critical' : p.stock_quantity <= 10 ? 'low' : 'ok',
    })),
    summary: {
      total: products.length,
      out_of_stock: products.filter(p => p.stock_quantity === 0).length,
      critical: products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length,
      low: products.filter(p => p.stock_quantity > 5 && p.stock_quantity <= 10).length,
    },
  });
});

// ─── GET /reports/audit-logs ──────────────────────────────────────────────
router.get('/audit-logs', authenticate, requireAdmin, (req, res) => {
  const { page = 1, limit = 50, actor_id, action, entity, from, to } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();

  let whereClause = '1=1';
  const params = [];

  if (actor_id) { whereClause += ' AND al.actor_id = ?'; params.push(actor_id); }
  if (action) { whereClause += ' AND al.action = ?'; params.push(action); }
  if (entity) { whereClause += ' AND al.entity = ?'; params.push(entity); }
  if (from) { whereClause += ' AND al.created_at >= ?'; params.push(from); }
  if (to) { whereClause += ' AND al.created_at <= ?'; params.push(to + 'T23:59:59'); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs al WHERE ${whereClause}`).get(...params).cnt;
  const logs = db.prepare(`
    SELECT al.*, u.full_name as actor_full_name
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.id
    WHERE ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  return success(res, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    logs: logs.map(l => ({
      ...l,
      old_data: l.old_data ? JSON.parse(l.old_data) : null,
      new_data: l.new_data ? JSON.parse(l.new_data) : null,
    })),
  });
});

// ─── GET /reports/counters ────────────────────────────────────────────────
router.get('/counters', authenticate, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  const db = getDb();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate = to || new Date().toISOString().split('T')[0];

  const counters = db.prepare(`
    SELECT c.id, c.counter_number, c.location, c.is_active, c.last_seen_at,
           COUNT(b.id) as bill_count,
           COALESCE(SUM(b.total_paise), 0) as total_revenue_paise
    FROM counters c
    LEFT JOIN bills b ON c.id = b.counter_id
      AND b.status = 'paid'
      AND DATE(b.billed_at) BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY total_revenue_paise DESC
  `).all(fromDate, toDate);

  return success(res, {
    period: { from: fromDate, to: toDate },
    counters: counters.map(c => ({
      ...c,
      total_revenue: c.total_revenue_paise / 100,
      is_online: c.last_seen_at ? (new Date() - new Date(c.last_seen_at)) < 2 * 60 * 1000 : false,
    })),
  });
});

module.exports = router;
