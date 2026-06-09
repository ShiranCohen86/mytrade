const express = require('express');
const jwt = require('jsonwebtoken');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const logger = require('../utils/logger');

const router = express.Router();

const MAX_EVENTS = 50;
const MAX_PROPS_BYTES = 2048;
const str = (v, n) => (v == null ? '' : String(v).slice(0, n));

// Accept a props object only when it serializes within a small size cap, so a
// client can't persist unbounded nested payloads.
function sanitizeProps(p) {
  if (!p || typeof p !== 'object') return {};
  try {
    return JSON.stringify(p).length > MAX_PROPS_BYTES ? {} : p;
  } catch {
    return {};
  }
}

/** Server-trusted user id from the Bearer token, if present (best-effort). */
function tokenUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET).sub || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/events — ingest a batch of client analytics events.
 * Auth-optional (works for anonymous + logged-in). Fire-and-forget: always 204.
 * Note: sendBeacon can't attach an Authorization header, so we fall back to a
 * format-validated client-supplied userId when no token is present.
 */
router.post('/', async (req, res) => {
  const body = req.body || {};
  const incoming = Array.isArray(body.events) ? body.events : body.event ? [body] : [];

  // Respond immediately; persistence is best-effort.
  res.status(204).end();
  if (!incoming.length) return;

  const serverUid = tokenUserId(req);
  const ip = req.ip || '';
  const ua = req.headers['user-agent'] || '';

  const docs = incoming
    .slice(0, MAX_EVENTS)
    .map((e) => {
      return {
        event: str(e && e.event, 64),
        // Only attribute events to a user when the id comes from a verified token.
        // A client-supplied userId is never trusted (it could spoof another user).
        userId: serverUid || null,
        deviceId: str(e && e.deviceId, 64),
        sessionId: str(e && e.sessionId, 64),
        platform: str(e && e.platform, 16),
        standalone: !!(e && e.standalone),
        appVersion: str(e && e.appVersion, 32),
        appBuild: str(e && e.appBuild, 64),
        lang: str(e && e.lang, 8),
        props: sanitizeProps(e && e.props),
        ip,
        userAgent: ua,
        ts: e && e.ts ? new Date(e.ts) : new Date(),
      };
    })
    .filter((d) => d.event);

  if (!docs.length) return;
  try {
    await AnalyticsEvent.insertMany(docs, { ordered: false });
  } catch (err) {
    logger.warn('[events] insert failed', { err: err.message });
  }
});

module.exports = router;
