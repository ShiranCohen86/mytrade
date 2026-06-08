/**
 * Admin AI Market Intelligence routes — ADMIN & SUPER_ADMIN ONLY
 *
 * All routes are protected by two layers:
 *   1. adminAuth('logs.read') — verifies valid JWT + admin role + not suspended
 *   2. requireIntelligenceRole — further restricts to admin / super_admin only
 *
 * This feature must NEVER be accessible to support_agent or analyst roles.
 * No intelligence data is exposed to regular users under any circumstances.
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const HotStockScore = require('../../models/HotStockScore');
const { computeHotScores } = require('../../services/hotStockService');
const audit = require('../../services/auditService');

// ── RBAC guard ─────────────────────────────────────────────────────────────────
// Explicitly restricts to admin and super_admin — excludes support_agent + analyst.
const INTELLIGENCE_ROLES = new Set(['admin', 'super_admin']);

function requireIntelligenceRole(req, res, next) {
  if (!INTELLIGENCE_ROLES.has(req.adminUser?.role)) {
    return res.status(403).json({
      error: 'AI Market Intelligence requires admin or super_admin role.',
    });
  }
  next();
}

// ── GET /admin/intelligence/overview ──────────────────────────────────────────
// Summary panel: top stocks by stage + sector breakdown + last compute time.
router.get('/overview', adminAuth('logs.read'), requireIntelligenceRole, async (req, res) => {
  try {
    const [trending, accelerating, emerging, sectorBreakdown, lastDoc, totalTracked] =
      await Promise.all([
        HotStockScore.find({ trendStage: 'trending' })
          .sort({ hotScore: -1 })
          .limit(5)
          .select('symbol name hotScore sector confidence trendStage computedAt')
          .lean(),
        HotStockScore.find({ trendStage: 'accelerating' })
          .sort({ hotScore: -1 })
          .limit(5)
          .select('symbol name hotScore sector confidence trendStage computedAt')
          .lean(),
        HotStockScore.find({ trendStage: 'emerging' })
          .sort({ hotScore: -1 })
          .limit(5)
          .select('symbol name hotScore sector confidence trendStage computedAt')
          .lean(),
        HotStockScore.aggregate([
          {
            $group: {
              _id: '$sector',
              avgHotScore: { $avg: '$hotScore' },
              maxHotScore: { $max: '$hotScore' },
              stockCount: { $sum: 1 },
              trending: { $sum: { $cond: [{ $eq: ['$trendStage', 'trending'] }, 1, 0] } },
              accelerating: { $sum: { $cond: [{ $eq: ['$trendStage', 'accelerating'] }, 1, 0] } },
              emerging: { $sum: { $cond: [{ $eq: ['$trendStage', 'emerging'] }, 1, 0] } },
            },
          },
          { $sort: { avgHotScore: -1 } },
          { $limit: 12 },
        ]),
        HotStockScore.findOne().sort({ computedAt: -1 }).select('computedAt').lean(),
        HotStockScore.countDocuments(),
      ]);

    res.json({
      trending,
      accelerating,
      emerging,
      sectorBreakdown: sectorBreakdown.map((s) => ({
        sector: s._id || 'Unknown',
        avgHotScore: Math.round(s.avgHotScore ?? 0),
        maxHotScore: Math.round(s.maxHotScore ?? 0),
        stockCount: s.stockCount,
        breakdown: {
          trending: s.trending,
          accelerating: s.accelerating,
          emerging: s.emerging,
        },
      })),
      lastComputed: lastDoc?.computedAt || null,
      totalTracked,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/intelligence/hot-stocks ────────────────────────────────────────
// Paginated list of all scored stocks with optional filters.
router.get('/hot-stocks', adminAuth('logs.read'), requireIntelligenceRole, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.trendStage) filter.trendStage = req.query.trendStage;
    if (req.query.sector) filter.sector = { $regex: req.query.sector, $options: 'i' };
    if (req.query.confidence) filter.confidence = req.query.confidence;
    if (req.query.minScore) {
      const min = parseInt(req.query.minScore);
      if (!isNaN(min)) filter.hotScore = { $gte: min };
    }

    const [items, total] = await Promise.all([
      HotStockScore.find(filter)
        .sort({ hotScore: -1 })
        .skip(skip)
        .limit(limit)
        .select('-scoreHistory')
        .lean(),
      HotStockScore.countDocuments(filter),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/intelligence/hot-stocks/:symbol ────────────────────────────────
// Full detail for a single stock including score history for trend graph.
router.get(
  '/hot-stocks/:symbol',
  adminAuth('logs.read'),
  requireIntelligenceRole,
  async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const doc = await HotStockScore.findOne({ symbol }).lean();
      if (!doc) {
        return res.status(404).json({ error: 'No intelligence data for this symbol.' });
      }
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /admin/intelligence/sector-heatmap ────────────────────────────────────
// Aggregated sector momentum data for the heatmap chart.
router.get(
  '/sector-heatmap',
  adminAuth('logs.read'),
  requireIntelligenceRole,
  async (req, res) => {
    try {
      const heatmap = await HotStockScore.aggregate([
        {
          $group: {
            _id: '$sector',
            avgHotScore: { $avg: '$hotScore' },
            maxHotScore: { $max: '$hotScore' },
            stockCount: { $sum: 1 },
            trending: { $sum: { $cond: [{ $eq: ['$trendStage', 'trending'] }, 1, 0] } },
            accelerating: { $sum: { $cond: [{ $eq: ['$trendStage', 'accelerating'] }, 1, 0] } },
            emerging: { $sum: { $cond: [{ $eq: ['$trendStage', 'emerging'] }, 1, 0] } },
          },
        },
        { $sort: { avgHotScore: -1 } },
      ]);

      res.json(
        heatmap.map((h) => ({
          sector: h._id || 'Unknown',
          avgHotScore: Math.round(h.avgHotScore ?? 0),
          maxHotScore: Math.round(h.maxHotScore ?? 0),
          stockCount: h.stockCount,
          breakdown: {
            trending: h.trending,
            accelerating: h.accelerating,
            emerging: h.emerging,
          },
        }))
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /admin/intelligence/refresh ──────────────────────────────────────────
// Trigger a manual re-computation of hot stock scores. Logged as admin action.
router.post('/refresh', adminAuth('audit.read'), requireIntelligenceRole, async (req, res) => {
  try {
    audit.logAdmin(req, 'admin.intelligence.refresh', null, {}, 'info');
    const results = await computeHotScores();
    res.json({ computed: results?.length ?? 0, computedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/intelligence/export ────────────────────────────────────────────
// Export scored stocks as CSV or JSON. Capped at 1,000 rows. Logged.
router.get('/export', adminAuth('logs.export'), requireIntelligenceRole, async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const filter = {};
    if (req.query.trendStage) filter.trendStage = req.query.trendStage;

    const items = await HotStockScore.find(filter)
      .sort({ hotScore: -1 })
      .limit(1_000)
      .select('-scoreHistory -_id -__v')
      .lean();

    audit.logAdmin(req, 'admin.intelligence.export', null, { format, count: items.length }, 'info');

    if (format === 'csv') {
      const COLS = [
        'symbol', 'name', 'sector', 'hotScore', 'momentumScore',
        'saturationIndex', 'trendStage', 'confidence', 'computedAt',
      ];
      const escape = (v) => JSON.stringify(v == null ? '' : String(v));
      const rows = items.map((item) => COLS.map((c) => escape(item[c])).join(','));
      const csv = [COLS.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="hot-stocks-${Date.now()}.csv"`
      );
      return res.send(csv);
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
