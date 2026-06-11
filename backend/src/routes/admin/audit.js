const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const AuditLog = require('../../models/AuditLog');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Parse a date param, returning undefined for an invalid/empty value (so a typo'd
// filter fails loudly via validation rather than silently matching nothing).
function parseDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d; // null = present but invalid
}

// GET /admin/audit — query audit logs with filters + pagination
router.get('/', adminAuth('logs.read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.userId) {
      if (!Types.ObjectId.isValid(req.query.userId)) return res.status(400).json({ error: 'Invalid userId.' });
      filter.userId = req.query.userId;
    }
    if (req.query.actionType) filter.actionType = { $regex: escapeRegex(String(req.query.actionType).slice(0, 100)), $options: 'i' };
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.actorType) filter['actor.type'] = req.query.actorType;

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from === null || to === null) return res.status(400).json({ error: 'Invalid date filter.' });
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = from;
      if (to) filter.timestamp.$lte = to;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/audit/export — export logs as CSV or JSON
router.get('/export', adminAuth('logs.export'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) {
      if (!Types.ObjectId.isValid(req.query.userId)) return res.status(400).json({ error: 'Invalid userId.' });
      filter.userId = req.query.userId;
    }
    if (req.query.actionType) filter.actionType = req.query.actionType;
    if (req.query.severity) filter.severity = req.query.severity;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from === null || to === null) return res.status(400).json({ error: 'Invalid date filter.' });
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = from;
      if (to) filter.timestamp.$lte = to;
    }

    const format = req.query.format === 'json' ? 'json' : 'csv';
    // Cap export at 10,000 rows to prevent memory exhaustion
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(10000).lean();

    await audit.logAdmin(req, 'admin.audit.export', null, {
      format,
      rowCount: logs.length,
      filter,
    }, 'info');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-export.json"');
      return res.json(logs);
    }

    // CSV format
    const cols = ['eventId', 'timestamp', 'actionType', 'severity', 'userId',
      'actor.type', 'actor.email', 'actor.role', 'ip', 'correlationId'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = cols.join(',');
    const rows = logs.map((l) => cols.map((c) => {
      if (c.includes('.')) {
        const parts = c.split('.');
        return escape(parts.reduce((o, k) => o?.[k], l));
      }
      return escape(l[c]);
    }).join(','));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send([header, ...rows].join('\n'));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/audit/stats — aggregate counts by actionType and severity
router.get('/stats', adminAuth('audit.read'), async (req, res) => {
  try {
    const parsedSince = parseDate(req.query.since);
    if (parsedSince === null) return res.status(400).json({ error: 'Invalid "since" date.' });
    const since = parsedSince || new Date(Date.now() - 7 * 86400_000);

    const [byAction, bySeverity, byDay] = await Promise.all([
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$actionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ byAction, bySeverity, byDay });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
