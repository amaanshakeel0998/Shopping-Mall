'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const CURRENCY = process.env.CURRENCY_SYMBOL || 'Rs.';
const MALL_NAME = process.env.MALL_NAME || 'Grand Mall Plaza';
const MALL_ADDRESS = process.env.MALL_ADDRESS || 'Main Street, City';
const MALL_PHONE = process.env.MALL_PHONE || '';
const TAX_LABEL = process.env.TAX_LABEL || 'GST';

/**
 * Format paise to currency string
 */
function fmt(paise) {
  return `${CURRENCY} ${(paise / 100).toFixed(2)}`;
}

/**
 * Generate a PDF invoice for a bill.
 * Returns the file path of the generated PDF.
 */
function generateInvoicePDF(bill) {
  const storagePath = process.env.INVOICE_STORAGE_PATH || './data/invoices';
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  const filename = `invoice-${bill.invoice_number}.pdf`;
  const filePath = path.join(storagePath, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice ${bill.invoice_number}`,
        Author: MALL_NAME,
        Subject: 'Tax Invoice',
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ─── Header ───────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').text(MALL_NAME, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(MALL_ADDRESS, { align: 'center' });
    if (MALL_PHONE) doc.text(`Tel: ${MALL_PHONE}`, { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ─── Invoice Info ─────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
    doc.moveDown(0.5);

    const infoY = doc.y;
    doc.fontSize(10).font('Helvetica');

    // Left column
    doc.text(`Invoice No: ${bill.invoice_number}`, 50, infoY);
    doc.text(`Date: ${new Date(bill.billed_at).toLocaleDateString('en-PK')}`, 50);
    doc.text(`Time: ${new Date(bill.billed_at).toLocaleTimeString('en-PK')}`, 50);

    // Right column
    doc.text(`Counter: ${bill.counter_number || 'N/A'}`, 350, infoY);
    doc.text(`Staff: ${bill.employee_code || ''}`, 350);
    doc.text(`Cashier: ${bill.employee_name || ''}`, 350);

    doc.moveDown(1);

    // ─── Items Table ──────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#333333');
    doc.moveDown(0.3);

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('#', 50, doc.y, { width: 25 });
    doc.text('Item', 75, doc.y - doc.currentLineHeight(), { width: 220 });
    doc.text('Qty', 295, doc.y - doc.currentLineHeight(), { width: 50, align: 'center' });
    doc.text('Unit Price', 345, doc.y - doc.currentLineHeight(), { width: 90, align: 'right' });
    doc.text('Total', 435, doc.y - doc.currentLineHeight(), { width: 110, align: 'right' });
    doc.moveDown(0.3);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica').fontSize(9);
    bill.items.forEach((item, idx) => {
      const rowY = doc.y;
      doc.text(`${idx + 1}`, 50, rowY, { width: 25 });
      doc.text(item.product_name, 75, rowY, { width: 220 });
      doc.text(`${item.quantity}`, 295, rowY, { width: 50, align: 'center' });
      doc.text(fmt(item.unit_price_paise), 345, rowY, { width: 90, align: 'right' });
      doc.text(fmt(item.line_total_paise), 435, rowY, { width: 110, align: 'right' });

      // Tax/discount info on sub-row
      if (item.tax_rate_pct > 0 || item.discount_pct > 0) {
        doc.fontSize(8).fillColor('#666666');
        let subInfo = '';
        if (item.tax_rate_pct > 0) subInfo += `${TAX_LABEL} ${item.tax_rate_pct}%`;
        if (item.discount_pct > 0) subInfo += ` | Disc ${item.discount_pct}%`;
        doc.text(subInfo, 75, doc.y, { width: 220 });
        doc.fillColor('#000000').fontSize(9);
      }

      doc.moveDown(0.2);
    });

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ─── Totals ───────────────────────────────────────────────────────────
    const totalsX = 350;
    doc.fontSize(10).font('Helvetica');

    doc.text('Subtotal:', totalsX, doc.y, { width: 85 });
    doc.text(fmt(bill.subtotal_paise), totalsX + 85, doc.y - doc.currentLineHeight(), { width: 110, align: 'right' });
    doc.moveDown(0.3);

    if (bill.tax_paise > 0) {
      doc.text(`${TAX_LABEL}:`, totalsX, doc.y, { width: 85 });
      doc.text(fmt(bill.tax_paise), totalsX + 85, doc.y - doc.currentLineHeight(), { width: 110, align: 'right' });
      doc.moveDown(0.3);
    }

    if (bill.discount_paise > 0) {
      doc.fillColor('#cc0000');
      doc.text('Discount:', totalsX, doc.y, { width: 85 });
      doc.text(`-${fmt(bill.discount_paise)}`, totalsX + 85, doc.y - doc.currentLineHeight(), { width: 110, align: 'right' });
      doc.fillColor('#000000');
      doc.moveDown(0.3);
    }

    doc.moveTo(totalsX, doc.y).lineTo(545, doc.y).stroke('#333333');
    doc.moveDown(0.3);

    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('TOTAL:', totalsX, doc.y, { width: 85 });
    doc.text(fmt(bill.total_paise), totalsX + 85, doc.y - doc.currentLineHeight(), { width: 110, align: 'right' });
    doc.moveDown(0.5);

    // Payment info
    doc.fontSize(10).font('Helvetica');
    const payMethod = (bill.payment_method || 'cash').toUpperCase();
    doc.text(`Payment Method: ${payMethod}`, 50);
    if (bill.payment_ref) doc.text(`Reference: ${bill.payment_ref}`, 50);
    if (bill.cash_tendered) {
      doc.text(`Cash Tendered: ${fmt(bill.cash_tendered)}`, 50);
      doc.text(`Change: ${fmt(bill.change_given || 0)}`, 50);
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ─── Footer ───────────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('Thank you for shopping!', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('Please visit us again.', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#888888').text('This is a computer-generated invoice. No signature required.', { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

/**
 * Generate a plain-text thermal receipt (ESC/POS compatible).
 * Returns the receipt as a string for printing.
 */
function generateReceiptText(bill) {
  const WIDTH = 42; // 80mm printer width in chars
  const line = '─'.repeat(WIDTH);
  const dline = '═'.repeat(WIDTH);

  function center(text) {
    const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
    return ' '.repeat(pad) + text;
  }

  function row(left, right) {
    const space = WIDTH - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right;
  }

  const lines = [];
  lines.push(dline);
  lines.push(center(MALL_NAME));
  lines.push(center(MALL_ADDRESS));
  if (MALL_PHONE) lines.push(center(`Tel: ${MALL_PHONE}`));
  lines.push(dline);
  lines.push('');
  lines.push(row(`Invoice: ${bill.invoice_number}`, ''));
  lines.push(row(`Date: ${new Date(bill.billed_at).toLocaleDateString('en-PK')}`,
    `Time: ${new Date(bill.billed_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`));
  lines.push(row(`Counter: ${bill.counter_number || 'N/A'}`, `Staff: ${bill.employee_code || ''}`));
  lines.push(line);

  bill.items.forEach(item => {
    const itemName = item.product_name.length > WIDTH ? item.product_name.substring(0, WIDTH - 3) + '...' : item.product_name;
    lines.push(itemName);
    const qtyPrice = `  x${item.quantity} @ ${CURRENCY}${(item.unit_price_paise / 100).toFixed(2)}`;
    const total = `${CURRENCY}${(item.line_total_paise / 100).toFixed(2)}`;
    lines.push(row(qtyPrice, total));
    if (item.tax_rate_pct > 0) {
      lines.push(`  (incl. ${TAX_LABEL} ${item.tax_rate_pct}%)`);
    }
  });

  lines.push(line);
  lines.push(row('Subtotal:', fmt(bill.subtotal_paise)));
  if (bill.tax_paise > 0) lines.push(row(`${TAX_LABEL}:`, fmt(bill.tax_paise)));
  if (bill.discount_paise > 0) lines.push(row('Discount:', `-${fmt(bill.discount_paise)}`));
  lines.push(line);
  lines.push(row('TOTAL:', fmt(bill.total_paise)));
  lines.push(line);

  const payMethod = (bill.payment_method || 'cash').toUpperCase();
  lines.push(row(`Payment: ${payMethod}`, bill.cash_tendered ? fmt(bill.cash_tendered) : ''));
  if (bill.change_given) lines.push(row('Change:', fmt(bill.change_given)));

  lines.push(dline);
  lines.push(center('Thank you for shopping!'));
  lines.push(center('Please visit us again.'));
  lines.push(dline);
  lines.push('');

  return lines.join('\n');
}

module.exports = { generateInvoicePDF, generateReceiptText };
