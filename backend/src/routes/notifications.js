const express = require('express');
const { Types } = require('mongoose');
const auth = require('../middleware/auth');
const UserNotification = require('../models/UserNotification');
const notificationService = require('../services/notificationService');

const router = express.Router();
const TYPES = ['info', 'success', 'warning', 'alert'];

// ── Public (token-gated) — service-worker push-event reporting ───────────────
// The SW has no access to the user's JWT; it echoes the campaignId + the opaque
// per-delivery token from the push payload (a capability only that device saw).
// Always 204 so the SW never has to handle a body.
router.post('/push/event', async (req, res) => {
  try {
    const { campaignId, token, type } = req.body || {};
    if (campaignId && token && ['shown', 'click'].includes(type) && Types.ObjectId.isValid(campaignId)) {
      await notificationService.recordPushEvent(campaignId, String(token).slice(0, 64), type);
    }
  } catch { /* swallow — analytics beacon */ }
  return res.status(204).end();
});

// Everything below requires auth and is strictly scoped to the caller.
router.use(auth);

// GET /api/notifications?cursor=&limit=&filter=unread&type=
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { userId: req.user.id, dismissed: false };
    if (req.query.filter === 'unread') filter.read = false;
    if (TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (req.query.cursor && Types.ObjectId.isValid(req.query.cursor)) {
      filter._id = { $lt: req.query.cursor }; // keyset pagination (_id desc ≈ createdAt desc)
    }
    const rows = await UserNotification.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    res.json({
      notifications: rows.slice(0, limit).map(notificationService.toClient),
      nextCursor: hasMore ? String(rows[limit - 1]._id) : null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    res.json({ count: await notificationService.unreadCount(req.user.id) });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  try {
    res.json({ updated: await notificationService.markAllRead(req.user.id) });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

// POST /api/notifications/seen  { ids: [] }
router.post('/seen', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x) => Types.ObjectId.isValid(x)).slice(0, 100)
      : [];
    res.json({ seen: await notificationService.recordSeen(req.user.id, ids) });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const n = await notificationService.markRead(req.user.id, req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

// POST /api/notifications/:id/click
router.post('/:id/click', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const link = await notificationService.recordClick(req.user.id, req.params.id);
    if (link === null) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true, deepLink: link });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const ok = await notificationService.remove(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed.' });
  }
});

module.exports = router;
