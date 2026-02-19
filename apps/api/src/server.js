'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const { initDb, seedInitialData } = require('./lib/initDb');

// ─── Initialize Database ──────────────────────────────────────────────────
initDb();
seedInitialData();

// ─── Create Express App ───────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for serving admin panel HTML
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.ADMIN_ORIGIN || 'http://localhost:3000']
    : '*',
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Compression ──────────────────────────────────────────────────────────
app.use(compression());

// ─── Request Logging ──────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
}

// ─── Global Rate Limiting ─────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please slow down.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// ─── Static Files (Admin Panel) ───────────────────────────────────────────
const adminPanelPath = path.join(__dirname, '../../admin-panel/dist');
const counterAppPath = path.join(__dirname, '../../counter-app/dist');

if (fs.existsSync(adminPanelPath)) {
  app.use('/admin', express.static(adminPanelPath));
}

// Serve admin panel and counter app from public folder
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/bills', require('./routes/bills'));
app.use('/api/v1/employees', require('./routes/employees'));
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/categories', require('./routes/categories'));

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const { getDb } = require('./lib/database');
  let dbStatus = 'ok';
  try {
    getDb().prepare('SELECT 1').get();
  } catch (e) {
    dbStatus = 'error';
  }

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    version: '1.0.0',
    db: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    mall: process.env.MALL_NAME || 'Grand Mall Plaza',
  });
});

// ─── Serve Admin Panel SPA ────────────────────────────────────────────────
// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
  }

  // Try to serve the admin panel index
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : err.message,
    },
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         MALL POS SYSTEM — SERVER STARTED         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  API:        http://localhost:${PORT}/api/v1/         ║`);
  console.log(`║  Admin:      http://localhost:${PORT}/                ║`);
  console.log(`║  Health:     http://localhost:${PORT}/health          ║`);
  console.log(`║  Mall:       ${(process.env.MALL_NAME || 'Grand Mall Plaza').padEnd(36)}║`);
  console.log(`║  Env:        ${(process.env.NODE_ENV || 'development').padEnd(36)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
