'use strict';

const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/timeline — paginated, filterable personal activity feed
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = { userId: req.user.id };

    if (req.query.actionType) {
      filter.actionType = { $regex: req.query.actionType, $options: 'i' };
    }
    if (req.query.sector) {
      filter['metadata.sector'] = req.query.sector;
    }
    if (req.query.symbol) {
      filter['metadata.symbol'] = req.query.symbol.toUpperCase();
    }
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to)   filter.timestamp.$lte = new Date(req.query.to);
    }
    if (req.query.q) {
      const q = req.query.q.trim().slice(0, 50);
      filter.$or = [
        { actionType:       { $regex: q, $options: 'i' } },
        { 'metadata.symbol': { $regex: q, $options: 'i' } },
        { 'metadata.sector': { $regex: q, $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timeline/insights — personal behavioral analytics
router.get('/insights', async (req, res) => {
  try {
    const days  = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90));
    const since = new Date(Date.now() - days * 86400_000);

    let userId;
    try {
      userId = new Types.ObjectId(req.user.id);
    } catch {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const base   = { userId, timestamp: { $gte: since } };
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
            _id: '$metadata.symbol',
            count:   { $sum: 1 },
            sector:  { $first: '$metadata.sector' },
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

    const cryptoCount  = sectorBreakdown.find((s) => s._id === 'Crypto')?.count       || 0;
    const techCount    = sectorBreakdown.find((s) => s._id === 'Technology')?.count   || 0;
    const stableCount  = ['Utilities', 'Consumer', 'Healthcare'].reduce(
      (acc, sec) => acc + (sectorBreakdown.find((s) => s._id === sec)?.count || 0), 0
    );

    let riskLabel;
    if (cryptoCount  > totalSec * 0.2) riskLabel = 'High Risk / Speculative';
    else if (techCount > totalSec * 0.5) riskLabel = 'Growth-Oriented';
    else if (stableCount > totalSec * 0.5) riskLabel = 'Conservative';
    else riskLabel = 'Balanced';

    const activeDays      = byDay.length;
    const avgPerDay       = activeDays > 0 ? total / activeDays : 0;
    const engagementScore = Math.min(100, Math.round(
      (activeDays / days) * 60 + Math.min(avgPerDay * 2, 40)
    ));

    res.json({
      sectorBreakdown: sectors,
      topSymbols:      topSymbols.map((s) => ({
        symbol:          s._id,
        count:           s.count,
        sector:          s.sector || 'Other',
        lastInteraction: s.lastSeen,
      })),
      engagementByDay:    byDay,
      eventTypeSummary:   eventTypes.map((e) => ({ type: e._id, count: e.count })),
      riskProfile:        { label: riskLabel, cryptoCount, techCount, stableCount },
      totalEvents:        total,
      activeDays,
      engagementScore,
      periodDays:         days,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
