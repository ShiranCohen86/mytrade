const express = require('express');
const router = express.Router();
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
      const q = req.query.search.trim();
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
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
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/users/:id — full user profile with stats
router.get('/:id', adminAuth('users.read'), async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/users/:id/role — change role (super_admin only)
router.put('/:id/role', adminAuth('system.config'), async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /admin/users/:id/suspend — suspend or unsuspend a user
router.put('/:id/suspend', adminAuth('user.suspend'), async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/users/:id — permanent delete (super_admin only, logs the action)
router.delete('/:id', adminAuth('system.config'), async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
