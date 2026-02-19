'use strict';

const { getDb } = require('../lib/database');
const { v4: uuidv4 } = require('uuid');
const { auditLog } = require('../lib/audit');
const path = require('path');
const fs = require('fs');

/**
 * Generate a unique invoice number scoped to a counter.
 * Format: C01-2024-000001
 */
function generateInvoiceNumber(counterNumber) {
  const db = getDb();
  const year = new Date().getFullYear();
  const prefix = `${counterNumber}-${year}-`;

  // Find the highest existing invoice number for this counter+year
  const last = db.prepare(`
    SELECT invoice_number FROM bills
    WHERE invoice_number LIKE ?
    ORDER BY invoice_number DESC LIMIT 1
  `).get(`${prefix}%`);

  let seq = 1;
  if (last) {
    const parts = last.invoice_number.split('-');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }

  return `${prefix}${String(seq).padStart(6, '0')}`;
}

/**
 * Calculate bill totals from items array.
 * Uses integer arithmetic (paise) to avoid floating-point errors.
 */
function calculateTotals(items) {
  let subtotalPaise = 0;
  let taxPaise = 0;
  let discountPaise = 0;

  const processedItems = items.map(item => {
    const unitPrice = item.unit_price_paise;
    const qty = parseFloat(item.quantity) || 1;

    // Tax calculation
    const taxRatePct = parseFloat(item.tax_rate_pct) || 0;
    const itemTax = Math.round(unitPrice * taxRatePct / 100);

    // Discount calculation
    let itemDiscount = 0;
    if (item.discount_type === 'percentage' && item.discount_value) {
      itemDiscount = Math.round(unitPrice * parseFloat(item.discount_value) / 100);
    } else if (item.discount_type === 'flat' && item.discount_value) {
      itemDiscount = Math.round(parseFloat(item.discount_value) * 100);
    }

    const lineTotal = Math.round((unitPrice + itemTax - itemDiscount) * qty);

    subtotalPaise += Math.round(unitPrice * qty);
    taxPaise += Math.round(itemTax * qty);
    discountPaise += Math.round(itemDiscount * qty);

    return {
      ...item,
      unit_price_paise: unitPrice,
      tax_rate_pct: taxRatePct,
      discount_pct: item.discount_type === 'percentage' ? (item.discount_value || 0) : 0,
      discount_flat: item.discount_type === 'flat' ? Math.round((item.discount_value || 0) * 100) : 0,
      line_total_paise: lineTotal,
    };
  });

  const totalPaise = subtotalPaise + taxPaise - discountPaise;

  return { processedItems, subtotalPaise, taxPaise, discountPaise, totalPaise };
}

/**
 * Create a finalized bill atomically.
 * All items are validated, totals calculated, and bill + items inserted in one transaction.
 */
function createBill({ counter_id, employee_id, employee_name, items, payment_method, payment_ref, cash_tendered, notes }) {
  const db = getDb();

  // Validate all products exist and are active
  const productIds = items.map(i => i.product_id);
  const placeholders = productIds.map(() => '?').join(',');
  const products = db.prepare(`
    SELECT p.*, t.rate_pct as tax_rate_pct, d.type as discount_type, d.value as discount_value
    FROM products p
    LEFT JOIN tax_rates t ON p.tax_rate_id = t.id
    LEFT JOIN discounts d ON p.discount_id = d.id
      AND (d.valid_from IS NULL OR d.valid_from <= datetime('now'))
      AND (d.valid_to IS NULL OR d.valid_to >= datetime('now'))
      AND d.is_active = 1
    WHERE p.id IN (${placeholders}) AND p.is_active = 1
  `).all(...productIds);

  if (products.length !== productIds.length) {
    const foundIds = products.map(p => p.id);
    const missing = productIds.filter(id => !foundIds.includes(id));
    throw new Error(`One or more products are unavailable: ${missing.join(', ')}`);
  }

  // Build enriched items with current prices (snapshot at billing time)
  const enrichedItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    return {
      ...item,
      barcode: product.barcode,
      product_name: product.name,
      unit_price_paise: product.price_paise,
      tax_rate_pct: product.tax_rate_pct || 0,
      discount_type: product.discount_type,
      discount_value: product.discount_value,
    };
  });

  const { processedItems, subtotalPaise, taxPaise, discountPaise, totalPaise } = calculateTotals(enrichedItems);

  // Get counter number for invoice generation
  const counter = counter_id ? db.prepare('SELECT counter_number FROM counters WHERE id = ?').get(counter_id) : null;
  const counterNumber = counter ? counter.counter_number : 'GEN';

  const invoiceNumber = generateInvoiceNumber(counterNumber);
  const billId = uuidv4();
  const now = new Date().toISOString();

  // Calculate change
  const cashTenderedPaise = cash_tendered ? Math.round(parseFloat(cash_tendered) * 100) : null;
  const changeGivenPaise = cashTenderedPaise ? Math.max(0, cashTenderedPaise - totalPaise) : null;

  // Atomic transaction: insert bill + all items
  const insertBill = db.transaction(() => {
    db.prepare(`
      INSERT INTO bills (id, invoice_number, counter_id, employee_id, status,
        subtotal_paise, tax_paise, discount_paise, total_paise,
        payment_method, payment_ref, cash_tendered, change_given, notes, billed_at, created_at)
      VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      billId, invoiceNumber, counter_id || null, employee_id,
      subtotalPaise, taxPaise, discountPaise, totalPaise,
      payment_method || 'cash', payment_ref || null,
      cashTenderedPaise, changeGivenPaise,
      notes || null, now, now
    );

    const insertItem = db.prepare(`
      INSERT INTO bill_items (id, bill_id, product_id, barcode, product_name, quantity,
        unit_price_paise, tax_rate_pct, discount_pct, discount_flat, line_total_paise)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    processedItems.forEach(item => {
      insertItem.run(
        uuidv4(), billId, item.product_id, item.barcode, item.product_name,
        item.quantity, item.unit_price_paise, item.tax_rate_pct,
        item.discount_pct, item.discount_flat, item.line_total_paise
      );
    });

    // Deduct stock
    const updateStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?');
    processedItems.forEach(item => {
      updateStock.run(Math.floor(item.quantity), now, item.product_id);
    });

    return billId;
  });

  insertBill();

  auditLog({
    actorId: employee_id,
    actorName: employee_name,
    action: 'BILL_CREATED',
    entity: 'bills',
    entityId: billId,
    newData: { invoice_number: invoiceNumber, total_paise: totalPaise, payment_method },
    counterId: counter_id,
  });

  // Return full bill with items
  return getBillById(billId);
}

/**
 * Retrieve a complete bill with all items.
 */
function getBillById(billId) {
  const db = getDb();
  const bill = db.prepare(`
    SELECT b.*, u.full_name as employee_name, u.employee_code,
           c.counter_number, c.location as counter_location
    FROM bills b
    LEFT JOIN users u ON b.employee_id = u.id
    LEFT JOIN counters c ON b.counter_id = c.id
    WHERE b.id = ?
  `).get(billId);

  if (!bill) return null;

  const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY rowid ASC').all(billId);

  return {
    ...bill,
    subtotal: bill.subtotal_paise / 100,
    tax: bill.tax_paise / 100,
    discount: bill.discount_paise / 100,
    total: bill.total_paise / 100,
    cash_tendered: bill.cash_tendered ? bill.cash_tendered / 100 : null,
    change_given: bill.change_given ? bill.change_given / 100 : null,
    items: items.map(item => ({
      ...item,
      unit_price: item.unit_price_paise / 100,
      line_total: item.line_total_paise / 100,
    })),
  };
}

module.exports = { createBill, getBillById, generateInvoiceNumber, calculateTotals };
