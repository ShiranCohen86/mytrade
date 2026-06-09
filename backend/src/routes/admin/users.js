const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const User = require('../../models/User');
const WatchlistItem = require('../../models/WatchlistItem');
const AuditLog = require('../../models/AuditLog');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');

// GET /admin/users — paginated user list with search + filter
router.get('/', adminAuth('users.read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search) {
      // Escape regex metacharacters to prevent ReDoS / unintended matches from
      // admin-supplied search input, and cap length.
      const safe = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.$or = [
        { email: { $regex: safe, $options: 'i' } },
        { displayName: { $regex: safe, $options: 'i' } },
      ];
    }

    if (req.query.role) filter.role = req.query.role;
    if (req.query.suspended === 'true') filter.isSuspended = true;
    if (req.query.suspended === 'false') filter.isSuspended = false;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const sortField = ['createdAt', 'email', 'displayName', 'role'].includes(req.query.sort)
      ? req.query.sort
      : 'createdAt';
    const sortDir = req.query.dir === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -resetToken -resetTokenExpiry')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/users/:id — full user profile with stats
router.get('/:id', adminAuth('users.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    const user = await User.findById(req.params.id)
      .select('-passwordHash -resetToken -resetTokenExpiry')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const [watchlistItems, recentAudit] = await Promise.all([
      WatchlistItem.find({ userId: req.params.id }).sort({ updatedAt: -1 }).lean(),
      AuditLog.find({ userId: req.params.id })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean(),
    ]);

    res.json({ user, watchlistItems, recentAudit });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/users/:id/insights — behavioral analytics for a specific user
router.get('/:id/insights', adminAuth('users.read'), async (req, res) => {
  try {
    const days  = Math.min(365, Math.max(7, parseInt(req.query.days) || 90));
    const since = new Date(Date.now() - days * 86400_000);

    let userId;
    try {
      userId = new Types.ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const base    = { userId, timestamp: { $gte: since } };
    const symBase = { ...base, 'metadata.symbol': { $exists: true, $nin: [null, ''] } };
    const secBase = { ...base, 'metadata.sector': { $exists: true, $nin: [null, '', 'Other'] } };

    const [eventTypes, topSymbols, sectorBreakdown, byDay, total] = await Promise.all([
      AuditLog.aggregate([
        { $match: base },
        { $group: { _id: '$actionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $match: symBase },
        {
          $group: {
            _id:      '$metadata.symbol',
            count:    { $sum: 1 },
            sector:   { $first: '$metadata.sector' },
            lastSeen: { $max: '$timestamp' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $match: secBase },
        { $group: { _id: '$metadata.sector', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $match: base },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.countDocuments(base),
    ]);

    const totalSec = sectorBreakdown.reduce((s, x) => s + x.count, 0);
    const sectors  = sectorBreakdown.map((s) => ({
      sector:     s._id,
      count:      s.count,
      percentage: totalSec > 0 ? Math.round((s.count / totalSec) * 100) : 0,
    }));

    const cryptoCount = sectorBreakdown.find((s) => s._id === 'Crypto')?.count     || 0;
    const techCount   = sectorBreakdown.find((s) => s._id === 'Technology')?.count || 0;
    const stableCount = ['Utilities', 'Consumer', 'Healthcare'].reduce(
      (acc, sec) => acc + (sectorBreakdown.find((s) => s._id === sec)?.count || 0), 0
    );

    let riskLabel;
    if (cryptoCount  > totalSec * 0.2)  riskLabel = 'High Risk / Speculative';
    else if (techCount > totalSec * 0.5) riskLabel = 'Growth-Oriented';
    else if (stableCount > totalSec * 0.5) riskLabel = 'Conservative';
    else riskLabel = 'Balanced';

    const activeDays      = byDay.length;
    const avgPerDay       = activeDays > 0 ? total / activeDays : 0;
    const engagementScore = Math.min(100, Math.round(
      (activeDays / days) * 60 + Math.min(avgPerDay * 2, 40)
    ));

    res.json({
      sectorBreakdown:  sectors,
      topSymbols:       topSymbols.map((s) => ({
        symbol:          s._id,
        count:           s.count,
        sector:          s.sector || 'Other',
        lastInteraction: s.lastSeen,
      })),
      engagementByDay:   byDay,
      eventTypeSummary:  eventTypes.map((e) => ({ type: e._id, count: e.count })),
      riskProfile:       { label: riskLabel, cryptoCount, techCount, stableCount },
      totalEvents:       total,
      activeDays,
      engagementScore,
      periodDays:        days,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /admin/users/:id/role — change role (super_admin only)
router.put('/:id/role', adminAuth('system.config'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    const { role } = req.body;
    const validRoles = ['super_admin', 'admin', 'support_agent', 'analyst', 'user'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}.` });
    }

    // Prevent self-demotion
    if (req.params.id === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: '-passwordHash -resetToken -resetTokenExpiry' }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await audit.logAdmin(req, 'admin.user.role_change', req.params.id, {
      newRole: role,
      targetEmail: user.email,
    }, 'warning');

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /admin/users/:id/suspend — suspend or unsuspend a user
router.put('/:id/suspend', adminAuth('user.suspend'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    const { suspend, reason } = req.body;
    if (typeof suspend !== 'boolean') {
      return res.status(400).json({ error: 'suspend must be a boolean.' });
    }

    if (req.params.id === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot suspend yourself.' });
    }

    const update = suspend
      ? { isSuspended: true, suspendedAt: new Date(), suspendedBy: req.adminUser.id, suspendReason: reason || '' }
      : { isSuspended: false, suspendedAt: null, suspendedBy: null, suspendReason: '' };

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      select: '-passwordHash -resetToken -resetTokenExpiry',
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await audit.logAdmin(
      req,
      suspend ? 'admin.user.suspend' : 'admin.user.unsuspend',
      req.params.id,
      { reason: reason || '', targetEmail: user.email },
      'warning'
    );

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /admin/users/:id — permanent delete (super_admin only, logs the action)
router.delete('/:id', adminAuth('system.config'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    if (req.params.id === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot delete yourself.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await audit.logAdmin(req, 'admin.user.delete', req.params.id, {
      targetEmail: user.email,
      targetRole: user.role,
    }, 'critical');

    await User.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
