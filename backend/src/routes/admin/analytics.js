const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const WatchlistItem = require('../../models/WatchlistItem');
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

module.exports = router;
