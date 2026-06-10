const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');

// Escape user input before it is used as a $regex, so search terms are treated
// literally (no ReDoS / unexpected matches). Mirrors admin/users.js.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /admin/support/impersonate/:userId
// Issues a short-lived (15-min) impersonation token for the target user.
// The token carries an impersonatedBy field so downstream code can detect it.
router.post('/impersonate/:userId', adminAuth('system.config'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (req.params.userId === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself.' });
    }

    const target = await User.findById(req.params.userId).lean();
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Only super_admin can impersonate other admins
    const isTargetAdmin = adminAuth.ADMIN_ROLES.has(target.role);
    if (isTargetAdmin && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can impersonate admin-level accounts.' });
    }

    const payload = {
      sub: target._id.toString(),
      email: target.email,
      displayName: target.displayName,
      impersonatedBy: req.adminUser.id,
      impersonatedAt: Date.now(),
    };

    const impersonationToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

    await audit.logAdmin(req, 'admin.support.impersonate', req.params.userId, {
      targetEmail: target.email,
      targetRole: target.role,
      expiresIn: '15m',
    }, 'critical');

    res.json({
      token: impersonationToken,
      expiresIn: 900,
      targetUser: {
        id: target._id,
        email: target.email,
        displayName: target.displayName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/support/users/:userId/activity — recent activity timeline for a user
router.get('/users/:userId/activity', adminAuth('users.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 100);
    const logs = await AuditLog.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /admin/support/users/:userId/flag — flag user for suspicious behavior
router.post('/users/:userId/flag', adminAuth('user.suspend'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    const { reason, severity = 'warning' } = req.body;
    if (!['warning', 'critical'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be warning or critical.' });
    }

    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await audit.logAdmin(req, 'admin.support.flag_user', req.params.userId, {
      reason: String(reason || '').slice(0, 500),
      targetEmail: user.email,
    }, severity);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/support/search — cross-entity search (email, IP, correlationId)
router.get('/search', adminAuth('users.read'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.json({ users: [], logs: [] });
    const safe = escapeRegex(q);

    const [users, logs] = await Promise.all([
      User.find({
        $or: [
          { email: { $regex: safe, $options: 'i' } },
          { displayName: { $regex: safe, $options: 'i' } },
        ],
      })
        .select('-passwordHash -resetToken -resetTokenExpiry')
        .limit(10)
        .lean(),
      AuditLog.find({
        $or: [
          { ip: q },
          { correlationId: q },
          { 'actor.email': { $regex: safe, $options: 'i' } },
        ],
      })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({ users, logs });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
