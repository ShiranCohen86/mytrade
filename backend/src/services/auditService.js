const crypto = require('crypto');

let AuditLog;

function getModel() {
  if (!AuditLog) AuditLog = require('../models/AuditLog');
  return AuditLog;
}

/**
 * Fire-and-forget audit logger. Never throws — a logging failure must never
 * break the main request flow.
 *
 * @param {object} opts
 * @param {string}  opts.actionType  e.g. 'auth.login', 'watchlist.add', 'admin.user.suspend'
 * @param {object}  opts.actor       { type: 'user'|'admin'|'system', id, email, role }
 * @param {string}  [opts.userId]    The affected user's ObjectId string (may equal actor.id)
 * @param {object}  [opts.metadata]  Arbitrary JSON payload
 * @param {string}  [opts.severity]  'info'|'warning'|'critical' (default: 'info')
 * @param {object}  [opts.req]       Express request (extracts ip, userAgent, correlationId)
 */
async function log(opts) {
  try {
    const Model = getModel();
    await Model.create({
      eventId: crypto.randomUUID(),
      userId: opts.userId || null,
      actor: {
        type: opts.actor.type,
        id: opts.actor.id || null,
        email: opts.actor.email || '',
        role: opts.actor.role || 'user',
      },
      actionType: opts.actionType,
      timestamp: new Date(),
      ip: opts.req?.ip || opts.ip || '',
      userAgent: opts.req?.headers?.['user-agent'] || opts.userAgent || '',
      metadata: opts.metadata || {},
      correlationId: opts.req?.id || opts.correlationId || '',
      severity: opts.severity || 'info',
    });
  } catch (err) {
    // Logging failures are silent — write to console but never propagate
    console.error('[audit] write failed:', err.message);
  }
}

/**
 * Convenience: log from a regular user request (actor = the authenticated user).
 */
async function logUser(req, actionType, metadata = {}, severity = 'info') {
  return log({
    actionType,
    actor: {
      type: 'user',
      id: req.user?.id,
      email: req.user?.email || '',
      role: 'user',
    },
    userId: req.user?.id,
    metadata,
    severity,
    req,
  });
}

/**
 * Convenience: log from an admin request (actor = the admin, userId = target user).
 */
async function logAdmin(req, actionType, targetUserId, metadata = {}, severity = 'info') {
  return log({
    actionType,
    actor: {
      type: 'admin',
      id: req.adminUser?.id,
      email: req.adminUser?.email || '',
      role: req.adminUser?.role || 'admin',
    },
    userId: targetUserId || null,
    metadata,
    severity,
    req,
  });
}

/**
 * Convenience: log a system event (no user context).
 */
async function logSystem(actionType, metadata = {}, severity = 'info') {
  return log({
    actionType,
    actor: { type: 'system', id: null, email: 'system', role: 'system' },
    userId: null,
    metadata,
    severity,
  });
}

module.exports = { log, logUser, logAdmin, logSystem };
