'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../lib/database');
const { success, error, paginated } = require('../lib/response');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');
const { createBill, getBillById } = require('../services/billing');
const { generateInvoicePDF, generateReceiptText } = require('../services/pdfGenerator');
const path = require('path');
const fs = require('fs');

// ─── POST /bills ──────────────────────────────────────────────────────────
router.post('/', authenticate, (req, res) => {
  const { counter_id, items, payment_method, payment_ref, cash_tendered, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, 'NO_ITEMS', 'Cannot create a bill with no items.', 400);
  }

  // Validate each item
  for (const item of items) {
    if (!item.product_id) {
      return error(res, 'INVALID_ITEM', 'Each item must have a product_id.', 400);
    }
    if (!item.quantity || parseFloat(item.quantity) <= 0) {
      return error(res, 'INVALID_QUANTITY', 'Each item must have a valid quantity greater than 0.', 400);
    }
  }

  try {
    const bill = createBill({
      counter_id: counter_id || req.user.counter_id,
      employee_id: req.user.sub,
      employee_name: req.user.full_name,
      items,
      payment_method,
      payment_ref,
      cash_tendered,
      notes,
    });

    // Generate PDF asynchronously (don't block response)
    generateInvoicePDF(bill).then(pdfPath => {
      const db = getDb();
      db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(pdfPath, bill.id);
    }).catch(err => {
      console.error('[PDF] Failed to generate invoice PDF:', err.message);
    });

    return success(res, bill, 201);
  } catch (err) {
    console.error('[BILLING] Error creating bill:', err.message);
    return error(res, 'BILLING_ERROR', err.message || 'Failed to create bill. Please try again.', 500);
  }
});

// ─── GET /bills ───────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const { page = 1, limit = 20, from, to, employee_id, counter_id, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();

  let whereClause = '1=1';
  const params = [];

  // Employees can only see their own bills
  if (req.user.role === 'employee') {
    whereClause += ' AND b.employee_id = ?';
    params.push(req.user.sub);
  } else if (employee_id) {
    whereClause += ' AND b.employee_id = ?';
    params.push(employee_id);
  }

  if (counter_id) { whereClause += ' AND b.counter_id = ?'; params.push(counter_id); }
  if (status) { whereClause += ' AND b.status = ?'; params.push(status); }
  if (from) { whereClause += ' AND b.billed_at >= ?'; params.push(from); }
  if (to) { whereClause += ' AND b.billed_at <= ?'; params.push(to + 'T23:59:59'); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM bills b WHERE ${whereClause}`).get(...params).cnt;
  const bills = db.prepare(`
    SELECT b.*, u.full_name as employee_name, u.employee_code, c.counter_number
    FROM bills b
    LEFT JOIN users u ON b.employee_id = u.id
    LEFT JOIN counters c ON b.counter_id = c.id
    WHERE ${whereClause}
    ORDER BY b.billed_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const formatted = bills.map(b => ({
    ...b,
    subtotal: b.subtotal_paise / 100,
    tax: b.tax_paise / 100,
    discount: b.discount_paise / 100,
    total: b.total_paise / 100,
  }));

  return paginated(res, formatted, total, page, limit);
});

// ─── GET /bills/held/:counter_id ──────────────────────────────────────────
router.get('/held/:counter_id', authenticate, (req, res) => {
  const db = getDb();
  const held = db.prepare(`
    SELECT h.*, u.full_name as employee_name
    FROM held_bills h
    LEFT JOIN users u ON h.employee_id = u.id
    WHERE h.counter_id = ?
    ORDER BY h.created_at DESC
  `).all(req.params.counter_id);

  return success(res, held.map(h => ({
    ...h,
    items: JSON.parse(h.items_json),
  })));
});

// ─── POST /bills/hold ─────────────────────────────────────────────────────
router.post('/hold', authenticate, (req, res) => {
  const { counter_id, items, label } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, 'NO_ITEMS', 'Cannot hold a bill with no items.', 400);
  }

  const db = getDb();
  const id = uuidv4();
  const effectiveCounterId = counter_id || req.user.counter_id || 'unknown';

  db.prepare(`
    INSERT INTO held_bills (id, counter_id, employee_id, label, items_json, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, effectiveCounterId, req.user.sub, label || null, JSON.stringify(items));

  return success(res, { id, message: 'Bill held successfully. Press F3 to retrieve it.' }, 201);
});

// ─── POST /bills/:id/resume ───────────────────────────────────────────────
router.post('/:id/resume', authenticate, (req, res) => {
  const db = getDb();
  const held = db.prepare('SELECT * FROM held_bills WHERE id = ?').get(req.params.id);
  if (!held) return error(res, 'HELD_BILL_NOT_FOUND', 'Held bill not found.', 404);

  // Delete the held bill
  db.prepare('DELETE FROM held_bills WHERE id = ?').run(req.params.id);

  return success(res, {
    items: JSON.parse(held.items_json),
    label: held.label,
    message: 'Bill resumed.',
  });
});

// ─── DELETE /bills/held/:id ───────────────────────────────────────────────
router.delete('/held/:id', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM held_bills WHERE id = ?').run(req.params.id);
  return success(res, { message: 'Held bill discarded.' });
});

// ─── GET /bills/:invoice_number ───────────────────────────────────────────
router.get('/:invoice', authenticate, (req, res) => {
  const db = getDb();

  // Try by invoice number first, then by ID
  let bill = db.prepare(`
    SELECT b.* FROM bills b WHERE b.invoice_number = ?
  `).get(req.params.invoice);

  if (!bill) {
    bill = db.prepare('SELECT b.* FROM bills b WHERE b.id = ?').get(req.params.invoice);
  }

  if (!bill) return error(res, 'BILL_NOT_FOUND', 'Bill not found.', 404);

  // Employees can only see their own bills
  if (req.user.role === 'employee' && bill.employee_id !== req.user.sub) {
    return error(res, 'FORBIDDEN', 'You can only view your own bills.', 403);
  }

  const fullBill = getBillById(bill.id);
  return success(res, fullBill);
});

// ─── GET /bills/:id/pdf ───────────────────────────────────────────────────
router.get('/:id/pdf', authenticate, (req, res) => {
  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? OR invoice_number = ?').get(req.params.id, req.params.id);
  if (!bill) return error(res, 'BILL_NOT_FOUND', 'Bill not found.', 404);

  if (req.user.role === 'employee' && bill.employee_id !== req.user.sub) {
    return error(res, 'FORBIDDEN', 'Access denied.', 403);
  }

  const fullBill = getBillById(bill.id);

  // If PDF already exists, serve it
  if (bill.pdf_path && fs.existsSync(bill.pdf_path)) {
    return res.download(bill.pdf_path, `invoice-${bill.invoice_number}.pdf`);
  }

  // Generate on demand
  generateInvoicePDF(fullBill).then(pdfPath => {
    db.prepare('UPDATE bills SET pdf_path = ? WHERE id = ?').run(pdfPath, bill.id);
    res.download(pdfPath, `invoice-${bill.invoice_number}.pdf`);
  }).catch(err => {
    return error(res, 'PDF_ERROR', 'Failed to generate PDF. Please try again.', 500);
  });
});

// ─── GET /bills/:id/receipt ───────────────────────────────────────────────
router.get('/:id/receipt', authenticate, (req, res) => {
  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ? OR invoice_number = ?').get(req.params.id, req.params.id);
  if (!bill) return error(res, 'BILL_NOT_FOUND', 'Bill not found.', 404);

  const fullBill = getBillById(bill.id);
  const receiptText = generateReceiptText(fullBill);

  return success(res, { receipt_text: receiptText, bill: fullBill });
});

// ─── DELETE /bills/:id (cancel) ───────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const { reason } = req.body;
  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return error(res, 'BILL_NOT_FOUND', 'Bill not found.', 404);
  if (bill.status === 'cancelled') return error(res, 'ALREADY_CANCELLED', 'Bill is already cancelled.', 400);

  db.prepare('UPDATE bills SET status = ?, notes = ? WHERE id = ?')
    .run('cancelled', reason || 'Cancelled by admin', req.params.id);

  auditLog({
    actorId: req.user.sub,
    actorName: req.user.full_name,
    action: 'BILL_CANCELLED',
    entity: 'bills',
    entityId: req.params.id,
    oldData: { status: bill.status },
    newData: { status: 'cancelled', reason },
    ipAddress: req.ip,
  });

  return success(res, { message: 'Bill cancelled successfully.' });
});

module.exports = router;
