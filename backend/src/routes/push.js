const express = require('express');
const auth = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const { PUSH_CATEGORIES } = require('../models/PushSubscription');
const pushService = require('../services/pushService');
const audit = require('../services/auditService');
const logger = require('../utils/logger');

const router = express.Router();

// Public: the client needs the VAPID public key to subscribe.
router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: pushService.getPublicKey(), enabled: pushService.isPushEnabled() });
});

// Everything below requires authentication.
router.use(auth);

function sanitizeCategories(input) {
  // Non-array (e.g. a new device with no stated preference) → default to all.
  // An explicit array is honored as-is, including empty, so a user can mute
  // every category (the old code silently re-enabled all on an empty array).
  if (!Array.isArray(input)) return PUSH_CATEGORIES;
  return input.filter((c) => PUSH_CATEGORIES.includes(c));
}

// GET /api/push/status — current subscription + preferences for this user
router.get('/status', async (req, res) => {
  try {
    const subs = await PushSubscription.find({ userId: req.user.id }).lean();
    const categories = subs.length ? subs[0].categories : PUSH_CATEGORIES;
    res.json({
      enabled: pushService.isPushEnabled(),
      subscribed: subs.length > 0,
      deviceCount: subs.length,
      categories,
      allCategories: PUSH_CATEGORIES,
    });
  } catch (err) {
    logger.error('GET /push/status', { err: err.message });
    res.status(500).json({ error: 'Failed to load notification status.' });
  }
});

// POST /api/push/subscribe — register/refresh a browser subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, platform, categories } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys ||
        !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ error: 'Invalid push subscription.' });
    }
    // Guard against re-assigning a subscription that already belongs to another
    // account: the upsert below keys on the endpoint, so without this an endpoint
    // could be stolen (and the victim's pushes redirected/suppressed).
    const owner = await PushSubscription.findOne({ endpoint: subscription.endpoint })
      .select('userId').lean();
    if (owner && String(owner.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'This subscription is registered to another account.' });
    }
    const doc = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: req.user.id,
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          platform: String(platform || '').slice(0, 16),
          userAgent: (req.headers['user-agent'] || '').slice(0, 256),
          lastSeenAt: new Date(),
        },
        $setOnInsert: { categories: sanitizeCategories(categories) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    audit.logUser(req, 'push.subscribe', { platform: doc.platform });
    res.status(201).json({ ok: true, categories: doc.categories });
  } catch (err) {
    logger.error('POST /push/subscribe', { err: err.message });
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});

// POST /api/push/unsubscribe — remove a subscription by endpoint
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required.' });
    await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
    audit.logUser(req, 'push.unsubscribe', {});
    res.json({ ok: true });
  } catch (err) {
    logger.error('POST /push/unsubscribe', { err: err.message });
    res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
});

// PUT /api/push/preferences — update enabled categories for this user (all devices)
router.put('/preferences', async (req, res) => {
  try {
    const categories = sanitizeCategories(req.body && req.body.categories);
    await PushSubscription.updateMany({ userId: req.user.id }, { $set: { categories } });
    audit.logUser(req, 'push.preferences', { categories });
    res.json({ ok: true, categories });
  } catch (err) {
    logger.error('PUT /push/preferences', { err: err.message });
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

module.exports = router;
