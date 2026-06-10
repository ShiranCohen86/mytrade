/**
 * Web Push sender. Configures web-push with VAPID keys (no-op if unset) and
 * delivers category-filtered notifications to a user's subscriptions, pruning
 * any that have expired (404/410).
 */
const webpush = require('web-push');
const logger = require('../utils/logger');

let enabled = false;
try {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mytrade.app';
  if (pub && priv) {
    webpush.setVapidDetails(subject, pub, priv);
    enabled = true;
    logger.info('[push] Web Push enabled (VAPID configured)');
  } else {
    logger.warn('[push] Web Push disabled — VAPID_PUBLIC_KEY/PRIVATE_KEY not set');
  }
} catch (err) {
  logger.error('[push] Failed to configure VAPID', { err: err.message });
}

// Lightweight rolling health stats so a persistent failure (bad VAPID, provider
// outage) is observable instead of silently logged per-send while campaigns still
// report "sent". Read via getStats() from an admin/health endpoint.
const stats = { sent: 0, pruned: 0, failed: 0, lastError: null, lastErrorAt: null };

function isPushEnabled() {
  return enabled;
}

function getStats() {
  const total = stats.sent + stats.failed;
  return { ...stats, failureRate: total ? stats.failed / total : 0 };
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

/** Lazy require to avoid a circular model load at startup. */
function getModel() {
  return require('../models/PushSubscription');
}

/**
 * Send a notification to all of a user's subscriptions that opted into `category`.
 * @returns {Promise<{sent:number, pruned:number}>}
 */
async function sendToUser(userId, category, payload) {
  if (!enabled || !userId) return { sent: 0, pruned: 0 };
  const PushSubscription = getModel();

  const query = { userId };
  if (category) query.categories = category;
  const subs = await PushSubscription.find(query).lean();
  if (!subs.length) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;
  const stale = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
          { TTL: payload.ttl || 60 * 60 * 12, urgency: payload.urgency || 'normal' }
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          stale.push(sub.endpoint);
          pruned += 1;
        } else {
          stats.failed += 1;
          stats.lastError = err.message;
          stats.lastErrorAt = new Date();
          logger.warn('[push] send failed', { err: err.message, status: err.statusCode });
        }
      }
    })
  );

  if (stale.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: stale } }).catch(() => {});
  }
  stats.sent += sent;
  stats.pruned += pruned;
  return { sent, pruned };
}

/** Convenience: count a user's active subscriptions (for badge / settings UI). */
async function countForUser(userId) {
  if (!userId) return 0;
  return getModel().countDocuments({ userId }).catch(() => 0);
}

module.exports = { isPushEnabled, getPublicKey, getStats, sendToUser, countForUser };
