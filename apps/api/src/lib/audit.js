'use strict';

const { getDb } = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * Write an immutable audit log entry.
 * Called after every significant action (login, product change, bill creation, etc.)
 */
function auditLog({ actorId, actorName, action, entity, entityId, oldData, newData, ipAddress, counterId }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, old_data, new_data, ip_address, counter_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      actorId || null,
      actorName || null,
      action,
      entity,
      entityId || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      ipAddress || null,
      counterId || null
    );
  } catch (err) {
    // Audit log failures must never crash the main operation
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { auditLog };
