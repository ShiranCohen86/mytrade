/**
 * Admin AI Market Intelligence routes — ADMIN & SUPER_ADMIN ONLY
 *
 * All routes are protected by two layers:
 *   1. adminAuth('logs.read') — verifies valid JWT + admin role + not suspended
 *   2. requireIntelligenceRole — further restricts to admin / super_admin only
 *
 * Scores are based on the expectationEngine: analyst targets, P/E vs sector,
 * price momentum, and recommendation key — all sourced from Yahoo Finance.
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const Stock = require('../../models/Stock');
const expectationEngine = require('../../engines/expectationEngine');
const audit = require('../../services/auditService');
const { runScan } = require('../../jobs/newsTickerScan');
const { syncUniverseStocks } = require('../../jobs/universeSync');

// ── RBAC guard ─────────────────────────────────────────────────────────────────
const INTELLIGENCE_ROLES = new Set(['admin', 'super_admin']);

function requireIntelligenceRole(req, res, next) {
  if (!INTELLIGENCE_ROLES.has(req.adminUser?.role)) {
    return res.status(403).json({
      error: 'AI Market Intelligence requires admin or super_admin role.',
    });
  }
  next();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function labelToTier(label) {
  const map = { VERY_HIGH: 'very_high', HIGH: 'high', MODERATE: 'moderate', LOW: 'low' };
  return map[label] || 'low';
}

function mapStockToCard(s) {
  return {
    symbol: s.ticker,
    name: s.name || s.ticker,
    sector: s.sector || 'Unknown',
    score: s.analysis?.expectationScore ?? 0,
    label: s.analysis?.expectationLabel ?? 'LOW',
    tier: labelToTier(s.analysis?.expectationLabel),
    analyzedAt: s.analysis?.analyzedAt || null,
    price: s.cachedData?.price ?? null,
    analystTarget: s.cachedData?.analystTargetPrice ?? null,
    recommendationKey: s.cachedData?.recommendationKey ?? null,
  };
}

function mapStockToRow(s) {
  return {
    ...mapStockToCard(s),
    peRatio: s.cachedData?.peRatio ?? null,
    numberOfAnalysts: s.cachedData?.numberOfAnalysts ?? null,
  };
}

// ── GET /admin/intelligence/overview ──────────────────────────────────────────
router.get('/overview', adminAuth('logs.read'), requireIntelligenceRole, async (req, res) => {
  try {
    const baseSelect = 'ticker name sector analysis.expectationScore analysis.expectationLabel analysis.analyzedAt cachedData.price cachedData.analystTargetPrice cachedData.recommendationKey';

    const [
      veryHigh, high, moderate,
      sectorBreakdown, lastDoc, totalTracked,
      veryHighCount, highCount, moderateCount,
    ] = await Promise.all([
      Stock.find({ 'analysis.expectationLabel': 'VERY_HIGH' })
        .sort({ 'analysis.expectationScore': -1 }).limit(10).select(baseSelect).lean(),
      Stock.find({ 'analysis.expectationLabel': 'HIGH' })
        .sort({ 'analysis.expectationScore': -1 }).limit(10).select(baseSelect).lean(),
      Stock.find({ 'analysis.expectationLabel': 'MODERATE' })
        .sort({ 'analysis.expectationScore': -1 }).limit(10).select(baseSelect).lean(),
      Stock.aggregate([
        { $match: { 'analysis.expectationLabel': { $in: ['VERY_HIGH', 'HIGH', 'MODERATE'] } } },
        {
          $group: {
            _id: '$sector',
            avgScore: { $avg: '$analysis.expectationScore' },
            maxScore: { $max: '$analysis.expectationScore' },
            stockCount: { $sum: 1 },
            veryHigh: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'VERY_HIGH'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'HIGH'] }, 1, 0] } },
            moderate: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'MODERATE'] }, 1, 0] } },
          },
        },
        { $sort: { avgScore: -1 } },
        { $limit: 12 },
      ]),
      Stock.findOne({ 'analysis.analyzedAt': { $exists: true } })
        .sort({ 'analysis.analyzedAt': -1 }).select('analysis.analyzedAt').lean(),
      Stock.countDocuments({ 'analysis.expectationScore': { $gt: 0 } }),
      Stock.countDocuments({ 'analysis.expectationLabel': 'VERY_HIGH' }),
      Stock.countDocuments({ 'analysis.expectationLabel': 'HIGH' }),
      Stock.countDocuments({ 'analysis.expectationLabel': 'MODERATE' }),
    ]);

    res.json({
      veryHigh: veryHigh.map(mapStockToCard),
      high: high.map(mapStockToCard),
      moderate: moderate.map(mapStockToCard),
      counts: { veryHigh: veryHighCount, high: highCount, moderate: moderateCount },
      sectorBreakdown: sectorBreakdown.map((s) => ({
        sector: s._id || 'Unknown',
        avgScore: Math.round(s.avgScore ?? 0),
        maxScore: Math.round(s.maxScore ?? 0),
        stockCount: s.stockCount,
        breakdown: { veryHigh: s.veryHigh, high: s.high, moderate: s.moderate },
      })),
      lastComputed: lastDoc?.analysis?.analyzedAt || null,
      totalTracked,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /admin/intelligence/hot-stocks ────────────────────────────────────────
router.get('/hot-stocks', adminAuth('logs.read'), requireIntelligenceRole, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    // Default: show VERY_HIGH, HIGH, MODERATE (exclude LOW noise).
    // Explicit ?label=X overrides; ?all=true lifts the restriction entirely.
    const filter = req.query.all === 'true'
      ? { 'analysis.expectationScore': { $gt: 0 } }
      : { 'analysis.expectationLabel': { $in: ['VERY_HIGH', 'HIGH', 'MODERATE'] } };

    if (req.query.label) filter['analysis.expectationLabel'] = req.query.label;
    if (req.query.sector) filter.sector = { $regex: req.query.sector, $options: 'i' };
    if (req.query.minScore) {
      const min = parseInt(req.query.minScore);
      if (!isNaN(min)) filter['analysis.expectationScore'] = { $gte: min };
    }

    const [items, total] = await Promise.all([
      Stock.find(filter)
        .sort({ 'analysis.expectationScore': -1 })
        .skip(skip)
        .limit(limit)
        .select('ticker name sector analysis.expectationScore analysis.expectationLabel analysis.analyzedAt cachedData.price cachedData.analystTargetPrice cachedData.recommendationKey cachedData.peRatio cachedData.numberOfAnalysts')
        .lean(),
      Stock.countDocuments(filter),
    ]);

    res.json({
      items: items.map(mapStockToRow),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /admin/intelligence/hot-stocks/:symbol ────────────────────────────────
router.get(
  '/hot-stocks/:symbol',
  adminAuth('logs.read'),
  requireIntelligenceRole,
  async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const doc = await Stock.findOne({ ticker: symbol })
        .select('-cachedData.historical -__v')
        .lean();
      if (!doc) {
        return res.status(404).json({ error: 'No data for this symbol.' });
      }

      const price = doc.cachedData?.price ?? null;
      const analystTarget = doc.cachedData?.analystTargetPrice ?? null;
      const upside = price && analystTarget
        ? parseFloat((((analystTarget - price) / price) * 100).toFixed(1))
        : null;

      res.json({
        symbol: doc.ticker,
        name: doc.name || doc.ticker,
        sector: doc.sector || 'Unknown',
        score: doc.analysis?.expectationScore ?? 0,
        label: doc.analysis?.expectationLabel ?? 'LOW',
        tier: labelToTier(doc.analysis?.expectationLabel),
        analyzedAt: doc.analysis?.analyzedAt || null,
        price,
        analystTarget,
        analystLow: doc.cachedData?.analystLowPrice ?? null,
        analystHigh: doc.cachedData?.analystHighPrice ?? null,
        upside,
        recommendationKey: doc.cachedData?.recommendationKey ?? null,
        peRatio: doc.cachedData?.peRatio ?? null,
        numberOfAnalysts: doc.cachedData?.numberOfAnalysts ?? null,
        scoreHistory: (doc.scoreHistory || []).map((h) => ({
          score: h.expectationScore ?? 0,
          analyzedAt: h.analyzedAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// ── GET /admin/intelligence/sector-heatmap ────────────────────────────────────
router.get(
  '/sector-heatmap',
  adminAuth('logs.read'),
  requireIntelligenceRole,
  async (req, res) => {
    try {
      const heatmap = await Stock.aggregate([
        { $match: { 'analysis.expectationScore': { $gt: 0 } } },
        {
          $group: {
            _id: '$sector',
            avgScore: { $avg: '$analysis.expectationScore' },
            maxScore: { $max: '$analysis.expectationScore' },
            stockCount: { $sum: 1 },
            veryHigh: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'VERY_HIGH'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'HIGH'] }, 1, 0] } },
            moderate: { $sum: { $cond: [{ $eq: ['$analysis.expectationLabel', 'MODERATE'] }, 1, 0] } },
          },
        },
        { $sort: { avgScore: -1 } },
      ]);

      res.json(
        heatmap.map((h) => ({
          sector: h._id || 'Unknown',
          avgScore: Math.round(h.avgScore ?? 0),
          maxScore: Math.round(h.maxScore ?? 0),
          stockCount: h.stockCount,
          breakdown: { veryHigh: h.veryHigh, high: h.high, moderate: h.moderate },
        }))
      );
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// ── POST /admin/intelligence/refresh ──────────────────────────────────────────
// Full pipeline: discover new tickers → analyze unscored → recompute all scores.
router.post('/refresh', adminAuth('audit.read'), requireIntelligenceRole, async (req, res) => {
  try {
    audit.logAdmin(req, 'admin.intelligence.refresh', null, {}, 'info');

    // Step 1: scan news + movers + watchlists for new ticker candidates (async, don't block response)
    // runScan handles its own concurrency guard so calling it here is safe
    const scanPromise = runScan().catch((err) =>
      require('../../utils/logger').warn('[intelligence/refresh] scan error', { err: err.message })
    );

    // Step 2: analyze any newly discovered / stale universe tickers (runs concurrently with scan)
    const analyzed = await syncUniverseStocks().catch(() => 0);

    // Step 3: recompute expectation scores for all stocks that have price data
    const stocks = await Stock.find({ 'cachedData.price': { $gt: 0 } })
      .select('ticker sector cachedData.price cachedData.analystTargetPrice cachedData.peRatio cachedData.recommendationKey cachedData.historical')
      .lean();

    const ops = stocks.map((s) => {
      const result = expectationEngine.calculate({
        currentPrice: s.cachedData?.price,
        analystTargetPrice: s.cachedData?.analystTargetPrice,
        peRatio: s.cachedData?.peRatio,
        sector: s.sector,
        historicalPrices: s.cachedData?.historical || [],
        recommendationKey: s.cachedData?.recommendationKey,
      });
      return {
        updateOne: {
          filter: { ticker: s.ticker },
          update: {
            $set: {
              'analysis.expectationScore': result.score,
              'analysis.expectationLabel': result.label,
            },
          },
        },
      };
    });

    if (ops.length > 0) await Stock.bulkWrite(ops);

    // Let the scan finish in background — don't block the response for it
    scanPromise.catch(() => {});

    res.json({ computed: ops.length, analyzed, computedAt: new Date() });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /admin/intelligence/export ────────────────────────────────────────────
router.get('/export', adminAuth('logs.export'), requireIntelligenceRole, async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const filter = { 'analysis.expectationLabel': { $in: ['VERY_HIGH', 'HIGH', 'MODERATE'] } };
    if (req.query.label) filter['analysis.expectationLabel'] = req.query.label;

    const items = await Stock.find(filter)
      .sort({ 'analysis.expectationScore': -1 })
      .limit(1_000)
      .select('ticker name sector analysis.expectationScore analysis.expectationLabel analysis.analyzedAt cachedData.price cachedData.analystTargetPrice cachedData.recommendationKey cachedData.peRatio')
      .lean();

    audit.logAdmin(req, 'admin.intelligence.export', null, { format, count: items.length }, 'info');

    const mapped = items.map((s) => ({
      symbol: s.ticker,
      name: s.name || s.ticker,
      sector: s.sector || 'Unknown',
      expectationScore: s.analysis?.expectationScore ?? 0,
      expectationLabel: s.analysis?.expectationLabel ?? 'LOW',
      price: s.cachedData?.price ?? '',
      analystTarget: s.cachedData?.analystTargetPrice ?? '',
      recommendationKey: s.cachedData?.recommendationKey ?? '',
      peRatio: s.cachedData?.peRatio ?? '',
      analyzedAt: s.analysis?.analyzedAt ?? '',
    }));

    if (format === 'csv') {
      const COLS = ['symbol', 'name', 'sector', 'expectationScore', 'expectationLabel', 'price', 'analystTarget', 'recommendationKey', 'peRatio', 'analyzedAt'];
      const escape = (v) => JSON.stringify(v == null ? '' : String(v));
      const rows = mapped.map((item) => COLS.map((c) => escape(item[c])).join(','));
      const csv = [COLS.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expectation-scores-${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
