const express = require('express');
const { Types } = require('mongoose');
const NotificationCampaign = require('../../models/NotificationCampaign');
const NotificationDelivery = require('../../models/NotificationDelivery');
const UserNotification = require('../../models/UserNotification');
const User = require('../../models/User');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');
const segmentService = require('../../services/segmentService');
const dispatchQueue = require('../../services/dispatchQueue');

const router = express.Router();

const TYPES = ['info', 'success', 'warning', 'alert'];
const MODES = ['single', 'multiple', 'segment', 'all'];
const SEGMENTS = ['active', 'inactive', 'new', 'returning', 'pwa_installed', 'notif_enabled'];

// ── Validation ───────────────────────────────────────────────────────────────

// Deep links must be in-app relative paths (block open-redirect / phishing).
function validDeepLink(link) {
  if (!link) return true;
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && link.length <= 300;
}

function validateAudience(audience) {
  if (!audience || !MODES.includes(audience.mode)) return 'Invalid audience mode.';
  if (audience.mode === 'single' || audience.mode === 'multiple') {
    const arr = Array.isArray(audience.userIds) ? audience.userIds : [];
    if (!arr.length) return 'Select at least one user.';
    if (arr.some((id) => !Types.ObjectId.isValid(id))) return 'Invalid user id in audience.';
    if (audience.mode === 'single' && arr.length !== 1) return 'Single mode expects exactly one user.';
  }
  if (audience.mode === 'segment' && !SEGMENTS.includes(audience.segment)) return 'Invalid segment.';
  return null;
}

function parseDto(body) {
  const b = body || {};
  const title = String(b.title || '').trim();
  const message = String(b.message || '').trim();
  if (!title) return { error: 'Title is required.' };
  if (title.length > 120) return { error: 'Title too long (max 120).' };
  if (!message) return { error: 'Message is required.' };
  if (message.length > 1000) return { error: 'Message too long (max 1000).' };

  const type = TYPES.includes(b.type) ? b.type : 'info';
  const channels = {
    push: !!(b.channels && b.channels.push),
    inApp: b.channels ? !!b.channels.inApp : true,
  };
  if (!channels.push && !channels.inApp) return { error: 'Select at least one channel.' };

  if (!validDeepLink(b.deepLink)) return { error: 'Deep link must be an in-app path starting with "/".' };

  const audErr = validateAudience(b.audience);
  if (audErr) return { error: audErr };

  let expiresAt = null;
  if (b.expiresAt) {
    expiresAt = new Date(b.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return { error: 'Expiry must be a future date.' };
  }

  return {
    value: {
      title,
      message,
      type,
      icon: String(b.icon || '').slice(0, 16),
      imageUrl: String(b.imageUrl || '').slice(0, 500),
      deepLink: String(b.deepLink || '').slice(0, 300),
      actionText: String(b.actionText || '').slice(0, 40),
      expiresAt,
      channels,
      audience: {
        mode: b.audience.mode,
        userIds: (b.audience.userIds || []).map(String),
        segment: b.audience.mode === 'segment' ? b.audience.segment : null,
      },
      templateId: Types.ObjectId.isValid(b.templateId) ? b.templateId : null,
    },
  };
}

// ── List ─────────────────────────────────────────────────────────────────────

// GET /api/admin/notifications
router.get('/', adminAuth('notifications.read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.channel === 'push') filter['channels.push'] = true;
    if (req.query.channel === 'in_app') filter['channels.inApp'] = true;
    if (req.query.search) {
      const safe = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { message: { $regex: safe, $options: 'i' } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationCampaign.countDocuments(filter),
    ]);

    res.json({ campaigns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/admin/notifications/preview-count  { audience }
router.post('/preview-count', adminAuth('notifications.read'), async (req, res) => {
  try {
    const audErr = validateAudience(req.body && req.body.audience);
    if (audErr) return res.status(400).json({ error: audErr });
    const count = await segmentService.previewCount(req.body.audience);
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to compute recipients.' });
  }
});

// GET /api/admin/notifications/analytics?days=30
router.get('/analytics', adminAuth('notifications.read'), async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86_400_000);

    const [agg] = await NotificationCampaign.aggregate([
      { $match: { sentAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          campaigns: { $sum: 1 },
          recipients: { $sum: '$recipientCount' },
          pushSent: { $sum: '$stats.push.sent' },
          pushOpened: { $sum: '$stats.push.opened' },
          pushClicked: { $sum: '$stats.push.clicked' },
          inAppCreated: { $sum: '$stats.inApp.created' },
          inAppSeen: { $sum: '$stats.inApp.seen' },
          inAppRead: { $sum: '$stats.inApp.read' },
          inAppClicked: { $sum: '$stats.inApp.clicked' },
          inAppDismissed: { $sum: '$stats.inApp.dismissed' },
        },
      },
    ]);

    const inAppTrend = await UserNotification.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]);

    const pushTrend = await NotificationDelivery.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]);

    const a = agg || {};
    const rate = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
    res.json({
      push: {
        sent: a.pushSent || 0,
        opened: a.pushOpened || 0,
        clicked: a.pushClicked || 0,
        ctr: rate(a.pushClicked || 0, a.pushSent || 0),
      },
      inApp: {
        created: a.inAppCreated || 0,
        impressions: a.inAppSeen || 0,
        read: a.inAppRead || 0,
        clicked: a.inAppClicked || 0,
        dismissed: a.inAppDismissed || 0,
        readRate: rate(a.inAppRead || 0, a.inAppCreated || 0),
        dismissRate: rate(a.inAppDismissed || 0, a.inAppCreated || 0),
      },
      totals: { campaigns: a.campaigns || 0, recipients: a.recipients || 0 },
      trends: { inApp: inAppTrend, push: pushTrend },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// POST /api/admin/notifications  (create draft | send now | schedule)
router.post('/', adminAuth('notifications.send'), async (req, res) => {
  try {
    const dto = parseDto(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });

    const sendMode = ['draft', 'now', 'schedule'].includes(req.body.sendMode) ? req.body.sendMode : 'draft';
    let status = 'draft';
    let scheduledAt = null;
    if (sendMode === 'schedule') {
      scheduledAt = new Date(req.body.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        return res.status(400).json({ error: 'Schedule time must be in the future.' });
      }
      status = 'scheduled';
    }

    const campaign = await NotificationCampaign.create({
      ...dto.value,
      status,
      scheduledAt,
      timezone: String(req.body.timezone || 'UTC').slice(0, 64),
      createdBy: req.adminUser.id,
      createdByEmail: req.adminUser.email,
    });

    audit.logAdmin(req, 'admin.notification.create', null, {
      campaignId: String(campaign._id), sendMode, channels: dto.value.channels, audience: dto.value.audience,
    }, sendMode === 'now' ? 'warning' : 'info');

    if (sendMode === 'now') {
      dispatchQueue.enqueue(campaign._id);
      audit.logAdmin(req, 'admin.notification.send', null, { campaignId: String(campaign._id) }, 'warning');
    }

    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification.' });
  }
});

// GET /api/admin/notifications/:id
router.get('/:id', adminAuth('notifications.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const campaign = await NotificationCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ error: 'Not found.' });
    res.json({ campaign });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/admin/notifications/:id  (edit draft / scheduled only)
router.put('/:id', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found.' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(409).json({ error: 'Only draft or scheduled notifications can be edited.' });
    }
    const dto = parseDto(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });

    Object.assign(campaign, dto.value);
    if (campaign.status === 'scheduled' && req.body.scheduledAt) {
      const when = new Date(req.body.scheduledAt);
      if (Number.isNaN(when.getTime()) || when <= new Date()) {
        return res.status(400).json({ error: 'Schedule time must be in the future.' });
      }
      campaign.scheduledAt = when;
    }
    await campaign.save();
    audit.logAdmin(req, 'admin.notification.update', null, { campaignId: String(campaign._id) });
    res.json({ campaign });
  } catch {
    res.status(500).json({ error: 'Failed to update.' });
  }
});

// POST /api/admin/notifications/:id/send  (send a draft now)
router.post('/:id/send', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found.' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(409).json({ error: 'This notification has already been sent.' });
    }
    dispatchQueue.enqueue(campaign._id);
    audit.logAdmin(req, 'admin.notification.send', null, { campaignId: String(campaign._id) }, 'warning');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to send.' });
  }
});

// POST /api/admin/notifications/:id/cancel  (cancel a scheduled send)
router.post('/:id/cancel', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Not found.' });
    if (campaign.status !== 'scheduled') {
      return res.status(409).json({ error: 'Only scheduled notifications can be canceled.' });
    }
    campaign.status = 'canceled';
    await campaign.save();
    audit.logAdmin(req, 'admin.notification.cancel', null, { campaignId: String(campaign._id) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to cancel.' });
  }
});

// GET /api/admin/notifications/:id/deliveries?channel=push|in_app&status=&search=&page=
router.get('/:id/deliveries', adminAuth('notifications.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const campaignId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const channel = req.query.channel === 'in_app' ? 'in_app' : 'push';

    // Resolve email search → userId set.
    let userIdIn = null;
    if (req.query.search) {
      const safe = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      const users = await User.find({ email: { $regex: safe, $options: 'i' } }).select('_id').limit(500).lean();
      userIdIn = users.map((u) => u._id);
    }

    let rows = [];
    let total = 0;
    if (channel === 'push') {
      const filter = { campaignId };
      if (req.query.status) filter.status = req.query.status;
      if (userIdIn) filter.userId = { $in: userIdIn };
      [rows, total] = await Promise.all([
        NotificationDelivery.find(filter).sort({ _id: -1 }).skip(skip).limit(limit)
          .populate('userId', 'email displayName').lean(),
        NotificationDelivery.countDocuments(filter),
      ]);
      rows = rows.map((d) => ({
        userId: d.userId?._id ? String(d.userId._id) : null,
        email: d.userId?.email || '',
        channel: 'push',
        status: d.status,
        error: d.error || '',
        retryCount: d.retryCount || 0,
        clicked: !!d.clickedAt,
        createdAt: d.createdAt,
      }));
    } else {
      const filter = { campaignId };
      if (userIdIn) filter.userId = { $in: userIdIn };
      [rows, total] = await Promise.all([
        UserNotification.find(filter).sort({ _id: -1 }).skip(skip).limit(limit)
          .populate('userId', 'email displayName').lean(),
        UserNotification.countDocuments(filter),
      ]);
      rows = rows.map((n) => ({
        userId: n.userId?._id ? String(n.userId._id) : null,
        email: n.userId?.email || '',
        channel: 'in_app',
        status: n.clickedAt ? 'clicked' : n.read ? 'read' : n.seenAt ? 'seen' : 'delivered',
        read: !!n.read,
        clicked: !!n.clickedAt,
        createdAt: n.createdAt,
      }));
    }

    res.json({ deliveries: rows, channel, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load delivery log.' });
  }
});

module.exports = router;
