'use strict';

require('dotenv').config();
const { getDb } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function initDb() {
  const db = getDb();

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      parent_id   TEXT REFERENCES categories(id),
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
  `);

  // ─── TAX RATES ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      rate_pct    REAL NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ─── DISCOUNTS ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS discounts (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage' | 'flat'
      value       REAL NOT NULL DEFAULT 0,
      valid_from  TEXT,
      valid_to    TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id              TEXT PRIMARY KEY,
      barcode         TEXT NOT NULL UNIQUE,
      sku             TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      description     TEXT,
      category_id     TEXT NOT NULL REFERENCES categories(id),
      price_paise     INTEGER NOT NULL,
      tax_rate_id     TEXT REFERENCES tax_rates(id),
      discount_id     TEXT REFERENCES discounts(id),
      stock_quantity  INTEGER NOT NULL DEFAULT 0,
      unit            TEXT NOT NULL DEFAULT 'piece',
      is_active       INTEGER NOT NULL DEFAULT 1,
      attributes      TEXT DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
  `);

  // ─── USERS ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      employee_code   TEXT NOT NULL UNIQUE,
      username        TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      full_name       TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'employee',
      phone           TEXT,
      email           TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_login_at   TEXT,
      created_by      TEXT REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  // ─── COUNTERS ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS counters (
      id              TEXT PRIMARY KEY,
      counter_number  TEXT NOT NULL UNIQUE,
      location        TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_seen_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ─── SESSIONS ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      counter_id  TEXT REFERENCES counters(id),
      token_jti   TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      revoked_at  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(token_jti);
  `);

  // ─── BILLS ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT NOT NULL UNIQUE,
      counter_id      TEXT REFERENCES counters(id),
      employee_id     TEXT NOT NULL REFERENCES users(id),
      status          TEXT NOT NULL DEFAULT 'active',
      subtotal_paise  INTEGER NOT NULL DEFAULT 0,
      tax_paise       INTEGER NOT NULL DEFAULT 0,
      discount_paise  INTEGER NOT NULL DEFAULT 0,
      total_paise     INTEGER NOT NULL DEFAULT 0,
      payment_method  TEXT,
      payment_ref     TEXT,
      cash_tendered   INTEGER,
      change_given    INTEGER,
      pdf_path        TEXT,
      notes           TEXT,
      synced_at       TEXT,
      billed_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_invoice ON bills(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_bills_employee ON bills(employee_id, billed_at);
    CREATE INDEX IF NOT EXISTS idx_bills_counter ON bills(counter_id, billed_at);
    CREATE INDEX IF NOT EXISTS idx_bills_billed_at ON bills(billed_at);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
  `);

  // ─── BILL ITEMS ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id                TEXT PRIMARY KEY,
      bill_id           TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      product_id        TEXT NOT NULL REFERENCES products(id),
      barcode           TEXT NOT NULL,
      product_name      TEXT NOT NULL,
      quantity          REAL NOT NULL DEFAULT 1,
      unit_price_paise  INTEGER NOT NULL,
      tax_rate_pct      REAL DEFAULT 0,
      discount_pct      REAL DEFAULT 0,
      discount_flat     INTEGER DEFAULT 0,
      line_total_paise  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bill_items_product ON bill_items(product_id);
  `);

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          TEXT PRIMARY KEY,
      actor_id    TEXT REFERENCES users(id),
      actor_name  TEXT,
      action      TEXT NOT NULL,
      entity      TEXT NOT NULL,
      entity_id   TEXT,
      old_data    TEXT,
      new_data    TEXT,
      ip_address  TEXT,
      counter_id  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // ─── SYNC EVENTS (for offline support) ───────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      synced      INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      last_error  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_events(synced, created_at);
  `);

  // ─── HELD BILLS ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS held_bills (
      id          TEXT PRIMARY KEY,
      counter_id  TEXT NOT NULL,
      employee_id TEXT NOT NULL REFERENCES users(id),
      label       TEXT,
      items_json  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_held_counter ON held_bills(counter_id);
  `);

  console.log('✅ Database schema initialized');
  return db;
}

function seedInitialData() {
  const db = getDb();

  // Check if already seeded
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt > 0) {
    console.log('ℹ️  Database already has data, skipping seed');
    return;
  }

  const now = new Date().toISOString();

  // ─── Default Tax Rates ────────────────────────────────────────────────────
  const taxRates = [
    { id: uuidv4(), name: 'No Tax (0%)', rate_pct: 0 },
    { id: uuidv4(), name: 'GST 5%', rate_pct: 5 },
    { id: uuidv4(), name: 'GST 12%', rate_pct: 12 },
    { id: uuidv4(), name: 'GST 17%', rate_pct: 17 },
    { id: uuidv4(), name: 'GST 18%', rate_pct: 18 },
  ];
  const insertTax = db.prepare('INSERT INTO tax_rates (id, name, rate_pct) VALUES (?, ?, ?)');
  taxRates.forEach(t => insertTax.run(t.id, t.name, t.rate_pct));

  // ─── Default Categories ───────────────────────────────────────────────────
  const categories = [
    { id: uuidv4(), name: 'Groceries', sort_order: 1 },
    { id: uuidv4(), name: 'Beverages', sort_order: 2 },
    { id: uuidv4(), name: 'Dairy & Eggs', sort_order: 3 },
    { id: uuidv4(), name: 'Bakery', sort_order: 4 },
    { id: uuidv4(), name: 'Snacks & Confectionery', sort_order: 5 },
    { id: uuidv4(), name: 'Personal Care', sort_order: 6 },
    { id: uuidv4(), name: 'Household', sort_order: 7 },
    { id: uuidv4(), name: 'Electronics', sort_order: 8 },
    { id: uuidv4(), name: 'Clothing', sort_order: 9 },
    { id: uuidv4(), name: 'Toys & Games', sort_order: 10 },
  ];
  const insertCat = db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
  categories.forEach(c => insertCat.run(c.id, c.name, c.sort_order));

  // ─── Default Counters ─────────────────────────────────────────────────────
  const counters = [
    { id: uuidv4(), counter_number: 'C01', location: 'Main Entrance - Counter 1' },
    { id: uuidv4(), counter_number: 'C02', location: 'Main Entrance - Counter 2' },
    { id: uuidv4(), counter_number: 'C03', location: 'Food Court - Counter 1' },
    { id: uuidv4(), counter_number: 'C04', location: 'Electronics Section' },
    { id: uuidv4(), counter_number: 'C05', location: 'Clothing Section' },
  ];
  const insertCounter = db.prepare('INSERT INTO counters (id, counter_number, location) VALUES (?, ?, ?)');
  counters.forEach(c => insertCounter.run(c.id, c.counter_number, c.location));

  // ─── Admin User ───────────────────────────────────────────────────────────
  const adminId = uuidv4();
  const adminHash = bcrypt.hashSync('Admin@123', 12);
  db.prepare(`
    INSERT INTO users (id, employee_code, username, password_hash, full_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, 'EMP-001', 'admin', adminHash, 'System Administrator', 'admin', now, now);

  // ─── Sample Employee ──────────────────────────────────────────────────────
  const empId = uuidv4();
  const empHash = bcrypt.hashSync('Employee@123', 12);
  db.prepare(`
    INSERT INTO users (id, employee_code, username, password_hash, full_name, role, phone, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(empId, 'EMP-002', 'cashier01', empHash, 'Ahmed Ali', 'employee', '0300-1111111', adminId, now, now);

  // ─── Sample Products ──────────────────────────────────────────────────────
  const groceryCatId = categories[0].id;
  const beverageCatId = categories[1].id;
  const dairyCatId = categories[2].id;
  const bakeryCatId = categories[3].id;
  const snackCatId = categories[4].id;
  const tax5Id = taxRates[1].id;
  const tax17Id = taxRates[3].id;
  const noTaxId = taxRates[0].id;

  const sampleProducts = [
    { barcode: '8901030874543', sku: 'GRO-001', name: 'Basmati Rice 5kg', category_id: groceryCatId, price_paise: 85000, tax_rate_id: noTaxId, stock_quantity: 200, unit: 'bag' },
    { barcode: '8901030874544', sku: 'GRO-002', name: 'Cooking Oil 1L', category_id: groceryCatId, price_paise: 32000, tax_rate_id: tax17Id, stock_quantity: 150, unit: 'bottle' },
    { barcode: '8901030874545', sku: 'GRO-003', name: 'Sugar 1kg', category_id: groceryCatId, price_paise: 12000, tax_rate_id: noTaxId, stock_quantity: 300, unit: 'kg' },
    { barcode: '8901030874546', sku: 'GRO-004', name: 'Salt 800g', category_id: groceryCatId, price_paise: 4500, tax_rate_id: noTaxId, stock_quantity: 400, unit: 'pack' },
    { barcode: '8901030874547', sku: 'BEV-001', name: 'Mineral Water 1.5L', category_id: beverageCatId, price_paise: 8000, tax_rate_id: tax5Id, stock_quantity: 500, unit: 'bottle' },
    { barcode: '8901030874548', sku: 'BEV-002', name: 'Coca Cola 1.5L', category_id: beverageCatId, price_paise: 18000, tax_rate_id: tax17Id, stock_quantity: 200, unit: 'bottle' },
    { barcode: '8901030874549', sku: 'BEV-003', name: 'Orange Juice 1L', category_id: beverageCatId, price_paise: 22000, tax_rate_id: tax17Id, stock_quantity: 100, unit: 'carton' },
    { barcode: '8901030874550', sku: 'DAI-001', name: 'Full Cream Milk 1L', category_id: dairyCatId, price_paise: 18000, tax_rate_id: noTaxId, stock_quantity: 150, unit: 'carton' },
    { barcode: '8901030874551', sku: 'DAI-002', name: 'Butter 200g', category_id: dairyCatId, price_paise: 28000, tax_rate_id: tax17Id, stock_quantity: 80, unit: 'pack' },
    { barcode: '8901030874552', sku: 'DAI-003', name: 'Yogurt 500g', category_id: dairyCatId, price_paise: 15000, tax_rate_id: noTaxId, stock_quantity: 120, unit: 'cup' },
    { barcode: '8901030874553', sku: 'BAK-001', name: 'Bread Loaf (Brown)', category_id: bakeryCatId, price_paise: 9000, tax_rate_id: noTaxId, stock_quantity: 60, unit: 'loaf' },
    { barcode: '8901030874554', sku: 'BAK-002', name: 'Croissant (Pack of 4)', category_id: bakeryCatId, price_paise: 22000, tax_rate_id: tax17Id, stock_quantity: 40, unit: 'pack' },
    { barcode: '8901030874555', sku: 'SNK-001', name: 'Lays Chips 100g', category_id: snackCatId, price_paise: 8500, tax_rate_id: tax17Id, stock_quantity: 300, unit: 'pack' },
    { barcode: '8901030874556', sku: 'SNK-002', name: 'Chocolate Bar 50g', category_id: snackCatId, price_paise: 12000, tax_rate_id: tax17Id, stock_quantity: 250, unit: 'piece' },
    { barcode: '8901030874557', sku: 'SNK-003', name: 'Biscuits Pack 200g', category_id: snackCatId, price_paise: 7500, tax_rate_id: tax17Id, stock_quantity: 200, unit: 'pack' },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, barcode, sku, name, category_id, price_paise, tax_rate_id, stock_quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleProducts.forEach(p => {
    insertProduct.run(uuidv4(), p.barcode, p.sku, p.name, p.category_id, p.price_paise, p.tax_rate_id, p.stock_quantity, p.unit);
  });

  console.log('✅ Initial data seeded successfully');
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Default Login Credentials:');
  console.log('  Admin:    username=admin     password=Admin@123');
  console.log('  Employee: username=cashier01 password=Employee@123');
  console.log('═══════════════════════════════════════════');
}

// Run if called directly
if (require.main === module) {
  initDb();
  seedInitialData();
  process.exit(0);
}

module.exports = { initDb, seedInitialData };
