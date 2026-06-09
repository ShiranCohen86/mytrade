const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const WatchlistItem = require('../../models/WatchlistItem');
const AnalyticsEvent = require('../../models/AnalyticsEvent');
const adminAuth = require('../../middleware/adminAuth');

// GET /admin/analytics/overview — key metrics snapshot
router.get('/overview', adminAuth('logs.read'), async (req, res) => {
  try {
    const now = new Date();
    const d1 = new Date(now - 1 * 86400_000);
    const d7 = new Date(now - 7 * 86400_000);
    const d30 = new Date(now - 30 * 86400_000);

    const [
      totalUsers,
      activeToday,
      activeWeek,
      activeMonth,
      newToday,
      newWeek,
      newMonth,
      suspendedCount,
      totalWatchlistItems,
      activeWatchlistItems,
      totalLogs,
      criticalLogs7d,
      failedLogins7d,
    ] = await Promise.all([
      User.countDocuments(),
      AuditLog.distinct('userId', { timestamp: { $gte: d1 }, 'actor.type': 'user' })
        .then((r) => r.filter(Boolean).length),
      AuditLog.distinct('userId', { timestamp: { $gte: d7 }, 'actor.type': 'user' })
        .then((r) => r.filter(Boolean).length),
      AuditLog.distinct('userId', { timestamp: { $gte: d30 }, 'actor.type': 'user' })
        .then((r) => r.filter(Boolean).length),
      User.countDocuments({ createdAt: { $gte: d1 } }),
      User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ createdAt: { $gte: d30 } }),
      User.countDocuments({ isSuspended: true }),
      WatchlistItem.countDocuments(),
      WatchlistItem.countDocuments({ isDisabled: false }),
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ severity: 'critical', timestamp: { $gte: d7 } }),
      AuditLog.countDocuments({ actionType: 'auth.login_failed', timestamp: { $gte: d7 } }),
    ]);

    res.json({
      users: { total: totalUsers, suspended: suspendedCount },
      activity: {
        dau: activeToday,
        wau: activeWeek,
        mau: activeMonth,
      },
      signups: { today: newToday, week: newWeek, month: newMonth },
      watchlists: { total: totalWatchlistItems, active: activeWatchlistItems },
      system: { totalLogs, criticalLogs7d, failedLogins7d },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics/signups — daily signup trend (last N days)
router.get('/signups', adminAuth('logs.read'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400_000);

    const data = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data.map((d) => ({ date: d._id, count: d.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics/activity — daily active users trend
router.get('/activity', adminAuth('logs.read'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400_000);

    const data = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: since }, 'actor.type': 'user', userId: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      { $project: { date: '$_id', count: { $size: '$uniqueUsers' } } },
      { $sort: { date: 1 } },
    ]);

    res.json(data.map((d) => ({ date: d.date, count: d.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics/watchlists — most popular symbols + churn
router.get('/watchlists', adminAuth('logs.read'), async (req, res) => {
  try {
    const [mostAdded, mostRemoved, symbolPopularity] = await Promise.all([
      WatchlistItem.aggregate([
        { $group: { _id: '$symbol', addCount: { $sum: '$addCount' }, total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 15 },
      ]),
      WatchlistItem.aggregate([
        { $match: { isDisabled: true } },
        { $group: { _id: '$symbol', removeCount: { $sum: 1 } } },
        { $sort: { removeCount: -1 } },
        { $limit: 15 },
      ]),
      WatchlistItem.aggregate([
        { $group: { _id: '$symbol', active: { $sum: { $cond: [{ $eq: ['$isDisabled', false] }, 1, 0] } }, total: { $sum: 1 } } },
        { $sort: { active: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({ mostAdded, mostRemoved, symbolPopularity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics/security — failed logins, suspicious IPs
router.get('/security', adminAuth('audit.read'), async (req, res) => {
  try {
    const d7 = new Date(Date.now() - 7 * 86400_000);

    const [failedByIp, failedByEmail, recentCritical] = await Promise.all([
      AuditLog.aggregate([
        { $match: { actionType: 'auth.login_failed', timestamp: { $gte: d7 } } },
        { $group: { _id: '$ip', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AuditLog.aggregate([
        { $match: { actionType: 'auth.login_failed', timestamp: { $gte: d7 } } },
        { $group: { _id: '$metadata.email', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AuditLog.find({ severity: 'critical' })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({ failedByIp, failedByEmail, recentCritical });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/analytics/product — PWA / growth / activation funnels from client events
router.get('/product', adminAuth('logs.read'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400_000);

    const [byEvent, platforms, standaloneTrend] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { ts: { $gte: since } } },
        { $group: { _id: '$event', count: { $sum: 1 }, devices: { $addToSet: '$deviceId' } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ts: { $gte: since }, event: 'SESSION_START' } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ts: { $gte: since }, event: 'PWA_LAUNCHED_STANDALONE' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const map = {};
    byEvent.forEach((e) => { map[e._id] = { count: e.count, devices: (e.devices || []).filter(Boolean).length }; });
    const c = (k) => (map[k] ? map[k].count : 0);
    const dev = (k) => (map[k] ? map[k].devices : 0);
    const pct = (num, den) => (den ? +((num / den) * 100).toFixed(1) : 0);

    const installShown = c('INSTALL_PROMPT_SHOWN');
    const installed = c('PWA_INSTALLED');
    const softShown = c('SOFT_NOTIFICATION_PROMPT_SHOWN');
    const granted = c('NOTIFICATION_PERMISSION_GRANTED');

    res.json({
      days,
      totalEvents: byEvent.reduce((s, e) => s + e.count, 0),
      sessions: c('SESSION_START'),
      standaloneLaunches: c('PWA_LAUNCHED_STANDALONE'),
      standaloneDevices: dev('PWA_LAUNCHED_STANDALONE'),
      returningUsers: c('USER_RETURNED'),
      install: {
        shown: installShown,
        accepted: c('INSTALL_PROMPT_ACCEPTED'),
        dismissed: c('INSTALL_PROMPT_DISMISSED'),
        installed,
        conversionRate: pct(installed, installShown),
      },
      notifications: {
        softShown,
        softAccepted: c('SOFT_NOTIFICATION_PROMPT_ACCEPTED'),
        granted,
        denied: c('NOTIFICATION_PERMISSION_DENIED'),
        subscribed: c('PUSH_SUBSCRIBED'),
        optInRate: pct(granted, softShown),
      },
      activation: {
        onboardingCompleted: c('ONBOARDING_COMPLETED'),
        firstStockAdded: c('FIRST_STOCK_ADDED'),
        firstAlertSet: c('FIRST_ALERT_SET'),
        ahaReached: c('AHA_REACHED'),
        becameActive: c('USER_BECAME_ACTIVE'),
        becamePowerUser: c('USER_BECAME_POWER_USER'),
      },
      updates: { shown: c('UPDATE_PROMPT_SHOWN'), accepted: c('UPDATE_PROMPT_ACCEPTED') },
      platforms: platforms.map((p) => ({ platform: p._id || 'unknown', count: p.count })),
      standaloneTrend: standaloneTrend.map((x) => ({ date: x._id, count: x.count })),
      topEvents: byEvent.sort((a, b) => b.count - a.count).slice(0, 15).map((e) => ({ event: e._id, count: e.count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
