/**
 * Core notification service — campaign lifecycle, fan-out dispatch across the
 * in-app and push channels, per-user state mutations, and engagement recording.
 *
 * Reuses pushService (web-push delivery), realtimeService (socket.io), and
 * auditService (admin audit trail). Heavy fan-out is chunked; the dispatch entry
 * point is wrapped by dispatchQueue so it can move to BullMQ/Redis later.
 */
const crypto = require('crypto');
const NotificationCampaign = require('../models/NotificationCampaign');
const UserNotification = require('../models/UserNotification');
const NotificationDelivery = require('../models/NotificationDelivery');
const segmentService = require('./segmentService');
const realtimeService = require('./realtimeService');
const pushService = require('./pushService');
const logger = require('../utils/logger');

const CHUNK = 1000;
const PUSH_CONCURRENCY = 25;

// ── Content helpers ──────────────────────────────────────────────────────────

function pickContent(c) {
  return {
    title: c.title,
    message: c.message,
    type: c.type,
    icon: c.icon || '',
    imageUrl: c.imageUrl || '',
    deepLink: c.deepLink || '',
    actionText: c.actionText || '',
  };
}

/** Serialize a UserNotification (doc or POJO) for the client / socket. */
function toClient(n) {
  return {
    id: String(n._id),
    campaignId: n.campaignId ? String(n.campaignId) : null,
    title: n.title,
    message: n.message,
    type: n.type,
    icon: n.icon || '',
    imageUrl: n.imageUrl || '',
    deepLink: n.deepLink || '',
    actionText: n.actionText || '',
    read: !!n.read,
    createdAt: n.createdAt,
  };
}

function buildPushPayload(campaign, token) {
  // Only pass `icon`/`image` when they're real URLs — campaign.icon is usually an
  // emoji (great for the in-app card, invalid as an OS notification icon).
  const isUrl = (s) => typeof s === 'string' && /^(https?:)?\/\//.test(s);
  return {
    title: campaign.title,
    body: campaign.message,
    icon: isUrl(campaign.icon) ? campaign.icon : undefined,
    image: isUrl(campaign.imageUrl) ? campaign.imageUrl : undefined,
    url: campaign.deepLink || '/dashboard',
    tag: `campaign-${campaign._id}`,
    urgency: 'high',
    requireInteraction: campaign.type === 'alert',
    data: { campaignId: String(campaign._id), token, kind: 'admin' },
  };
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

async function runChunkInApp(campaign, chunk, content) {
  const docs = chunk.map((uid) => ({
    userId: uid,
    campaignId: campaign._id,
    ...content,
    expiresAt: campaign.expiresAt || null,
  }));
  let created = [];
  try {
    created = await UserNotification.insertMany(docs, { ordered: false });
  } catch (err) {
    created = err.insertedDocs || [];
    logger.warn('[notif] insertMany partial', { err: err.message, inserted: created.length });
  }
  let delivered = 0;
  for (const doc of created) {
    if (realtimeService.isUserConnected(doc.userId)) {
      realtimeService.emitToUser(doc.userId, 'notification:new', toClient(doc));
      delivered += 1;
    }
  }
  campaign.stats.inApp.created += created.length;
  campaign.stats.inApp.delivered += delivered;
}

async function runChunkPush(campaign, chunk) {
  // Bounded concurrency to avoid hammering the push provider.
  for (let i = 0; i < chunk.length; i += PUSH_CONCURRENCY) {
    const slice = chunk.slice(i, i + PUSH_CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(slice.map(async (uid) => {
      const token = crypto.randomBytes(12).toString('hex');
      const delivery = await NotificationDelivery.create({
        campaignId: campaign._id, userId: uid, channel: 'push', status: 'pending', token,
      });
      try {
        const res = await pushService.sendToUser(uid, 'product', buildPushPayload(campaign, token));
        delivery.sentCount = res.sent;
        delivery.status = res.sent > 0 ? 'sent' : 'failed';
        await delivery.save();
        if (res.sent > 0) campaign.stats.push.sent += 1;
        else campaign.stats.push.failed += 1;
      } catch (err) {
        delivery.status = 'failed';
        delivery.error = String(err.message || err).slice(0, 300);
        await delivery.save();
        campaign.stats.push.failed += 1;
      }
    }));
  }
}

/**
 * Fan a campaign out to all resolved recipients. Idempotency-guarded by status.
 * @returns {Promise<NotificationCampaign|null>}
 */
async function dispatch(campaignId) {
  const campaign = await NotificationCampaign.findById(campaignId);
  if (!campaign) return null;
  if (!['draft', 'scheduled', 'sending'].includes(campaign.status)) return campaign;

  campaign.status = 'sending';
  await campaign.save();

  let recipients;
  try {
    recipients = await segmentService.resolveUserIds(campaign.audience);
  } catch (err) {
    campaign.status = 'failed';
    campaign.error = String(err.message || err).slice(0, 300);
    await campaign.save();
    logger.error('[notif] recipient resolution failed', { campaignId: String(campaignId), err: err.message });
    return campaign;
  }

  campaign.recipientCount = recipients.length;
  const content = pickContent(campaign);

  try {
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const chunk = recipients.slice(i, i + CHUNK);
      if (campaign.channels.inApp) await runChunkInApp(campaign, chunk, content); // eslint-disable-line no-await-in-loop
      if (campaign.channels.push) await runChunkPush(campaign, chunk);             // eslint-disable-line no-await-in-loop
    }
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    await campaign.save();
    logger.info('[notif] campaign sent', {
      campaignId: String(campaignId), recipients: recipients.length,
      inApp: campaign.stats.inApp.created, push: campaign.stats.push.sent,
    });
  } catch (err) {
    campaign.status = 'failed';
    campaign.error = String(err.message || err).slice(0, 300);
    await campaign.save();
    logger.error('[notif] dispatch failed', { campaignId: String(campaignId), err: err.message });
  }
  return campaign;
}

// ── Recipient-side state ─────────────────────────────────────────────────────

async function unreadCount(userId) {
  return UserNotification.countDocuments({ userId, read: false, dismissed: false });
}

async function markRead(userId, notifId) {
  const n = await UserNotification.findOne({ _id: notifId, userId });
  if (!n) return null;
  if (!n.read) {
    n.read = true;
    n.readAt = new Date();
    await n.save();
    if (n.campaignId) {
      NotificationCampaign.updateOne({ _id: n.campaignId }, { $inc: { 'stats.inApp.read': 1 } }).catch(() => {});
    }
    realtimeService.emitToUser(userId, 'notification:update', { id: String(n._id), read: true });
  }
  return n;
}

async function markAllRead(userId) {
  const res = await UserNotification.updateMany(
    { userId, read: false, dismissed: false },
    { $set: { read: true, readAt: new Date() } }
  );
  realtimeService.emitToUser(userId, 'notification:update', { all: true, read: true });
  return res.modifiedCount || 0;
}

async function remove(userId, notifId) {
  const n = await UserNotification.findOneAndDelete({ _id: notifId, userId });
  if (!n) return false;
  if (n.campaignId) {
    NotificationCampaign.updateOne({ _id: n.campaignId }, { $inc: { 'stats.inApp.dismissed': 1 } }).catch(() => {});
  }
  realtimeService.emitToUser(userId, 'notification:update', { id: String(n._id), removed: true });
  return true;
}

async function recordClick(userId, notifId) {
  const n = await UserNotification.findOne({ _id: notifId, userId });
  if (!n) return null;
  const set = {};
  if (!n.clickedAt) set.clickedAt = new Date();
  if (!n.read) { set.read = true; set.readAt = new Date(); }
  if (Object.keys(set).length) await UserNotification.updateOne({ _id: n._id }, { $set: set });
  if (n.campaignId && !n.clickedAt) {
    NotificationCampaign.updateOne({ _id: n.campaignId }, { $inc: { 'stats.inApp.clicked': 1 } }).catch(() => {});
  }
  realtimeService.emitToUser(userId, 'notification:update', { id: String(n._id), read: true });
  return n.deepLink || '';
}

/** Mark a batch of notifications as seen (impression). Best-effort. */
async function recordSeen(userId, notifIds) {
  if (!Array.isArray(notifIds) || !notifIds.length) return 0;
  const fresh = await UserNotification.find({ _id: { $in: notifIds }, userId, seenAt: null })
    .select('_id campaignId').lean();
  if (!fresh.length) return 0;
  await UserNotification.updateMany(
    { _id: { $in: fresh.map((f) => f._id) } },
    { $set: { seenAt: new Date() } }
  );
  // Bump per-campaign impression counters.
  const perCampaign = new Map();
  fresh.forEach((f) => { if (f.campaignId) perCampaign.set(String(f.campaignId), (perCampaign.get(String(f.campaignId)) || 0) + 1); });
  for (const [cid, n] of perCampaign) {
    NotificationCampaign.updateOne({ _id: cid }, { $inc: { 'stats.inApp.seen': n } }).catch(() => {});
  }
  return fresh.length;
}

/** Record a push engagement event reported by the service worker (token-gated). */
async function recordPushEvent(campaignId, token, type) {
  if (!campaignId || !token) return false;
  const delivery = await NotificationDelivery.findOne({ campaignId, token });
  if (!delivery) return false;
  const now = new Date();
  if (type === 'shown' && !delivery.openedAt) {
    delivery.openedAt = now;
    if (delivery.status === 'sent') delivery.status = 'opened';
    await delivery.save();
    NotificationCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.push.opened': 1 } }).catch(() => {});
    return true;
  }
  if (type === 'click' && !delivery.clickedAt) {
    delivery.clickedAt = now;
    delivery.status = 'clicked';
    await delivery.save();
    NotificationCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.push.clicked': 1 } }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Per-user delivery primitive used by the automation engine (and any future
 * per-user, dynamic-content sender). Creates the in-app notification (+ realtime
 * socket emit) and/or sends push, attributing to a campaign or automation rule.
 * @returns {Promise<{notificationId, inApp:boolean, push:number}>}
 */
async function deliverToUser(userId, content, channels = {}, meta = {}) {
  const result = { notificationId: null, inApp: false, push: 0 };

  if (channels.inApp) {
    const doc = await UserNotification.create({
      userId,
      campaignId: meta.campaignId || null,
      automationRuleId: meta.automationRuleId || null,
      title: content.title,
      message: content.message,
      type: content.type || 'info',
      icon: content.icon || '',
      imageUrl: content.imageUrl || '',
      deepLink: content.deepLink || '',
      actionText: content.actionText || '',
      expiresAt: content.expiresAt || null,
    });
    result.notificationId = doc._id;
    result.inApp = true;
    if (realtimeService.isUserConnected(userId)) {
      realtimeService.emitToUser(userId, 'notification:new', toClient(doc));
    }
  }

  if (channels.push) {
    try {
      const res = await pushService.sendToUser(userId, 'product', {
        title: content.title,
        body: content.message,
        url: content.deepLink || '/dashboard',
        tag: meta.tag || `auto-${meta.automationRuleId || 'n'}`,
        urgency: meta.urgency || 'high',
        requireInteraction: content.type === 'alert',
      });
      result.push = res.sent;
    } catch { /* best-effort */ }
  }

  return result;
}

module.exports = {
  dispatch,
  deliverToUser,
  toClient,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  recordClick,
  recordSeen,
  recordPushEvent,
};
