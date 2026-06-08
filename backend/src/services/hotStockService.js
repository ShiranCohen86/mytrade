/**
 * Hot Stock Scoring Engine (ADMIN-ONLY)
 *
 * Computes predictive momentum scores for every stock that has appeared
 * in the platform. Designed to surface stocks gaining attention BEFORE
 * they become widely popular.
 *
 * Signal sources:
 *   1. WatchlistItem — watchlist adoption velocity (most reliable)
 *   2. AuditLog      — interaction events (views, alerts, notes, portfolio)
 *   3. Stock         — name, sector metadata
 *
 * Scoring dimensions:
 *   - Watchlist Growth Rate  (40 pts): recent adds vs. previous 48h
 *   - Interaction Growth Rate (35 pts): recent events vs. previous 48h
 *   - Unique User Engagement  (25 pts): distinct users / current watchers
 *   - Saturation Penalty     (-30 pts max): baseline popularity discount
 *
 * hot_score = clamp(momentum_score − saturation_index, 0, 100)
 */

const AuditLog = require('../models/AuditLog');
const WatchlistItem = require('../models/WatchlistItem');
const Stock = require('../models/Stock');
const HotStockScore = require('../models/HotStockScore');
const logger = require('../utils/logger');

const MAX_HISTORY = 30;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function growthRate(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 1.0 : 0;
  return (current - previous) / previous;
}

function classifyTrend(hotScore) {
  if (hotScore >= 70) return 'trending';
  if (hotScore >= 45) return 'accelerating';
  if (hotScore >= 15) return 'emerging';
  return 'saturated';
}

function classifyConfidence(totalSignalEvents, recentAdds) {
  if (totalSignalEvents > 50 || recentAdds > 10) return 'high';
  if (totalSignalEvents >= 10 || recentAdds >= 3) return 'medium';
  return 'low';
}

function buildExplanation(signals, trendStage, confidence) {
  const lines = [];

  if (signals.addGrowthRate > 0.5) {
    const pct = Math.round(signals.addGrowthRate * 100);
    lines.push(`${pct}% increase in watchlist additions over the last 48 hours`);
  } else if (signals.recentAdds_48h > 0) {
    const noun = signals.recentAdds_48h === 1 ? 'adoption' : 'adoptions';
    lines.push(`${signals.recentAdds_48h} new watchlist ${noun} detected in last 48 hours`);
  }

  if (signals.interactionGrowthRate > 0.3) {
    const pct = Math.round(signals.interactionGrowthRate * 100);
    lines.push(`${pct}% increase in user interactions vs. the previous 48-hour window`);
  } else if (signals.recentInteractions_48h > 0) {
    lines.push(`${signals.recentInteractions_48h} engagement event${signals.recentInteractions_48h > 1 ? 's' : ''} recorded in last 48 hours`);
  }

  if (signals.uniqueUsers_48h > 1) {
    lines.push(`${signals.uniqueUsers_48h} unique users engaged in last 48 hours`);
  }

  if (signals.totalActiveWatchers === 0 && signals.recentAdds_48h > 0) {
    lines.push('First-time appearance in platform watchlists — no prior saturation');
  }

  if (lines.length === 0) lines.push('Gradual baseline signals detected');

  const stageDescriptions = {
    emerging: 'This stock shows early momentum signals — attention is building below the radar',
    accelerating: 'This stock is rapidly gaining platform attention and interaction velocity',
    trending: 'This stock is widely gaining attention across the platform — broad user interest detected',
    saturated: 'This stock has high but plateaued baseline attention with limited growth velocity',
  };

  const confidenceLabel = confidence.charAt(0).toUpperCase() + confidence.slice(1);
  const signalLines = lines.map((l) => `• ${l}`).join('\n');

  return `${stageDescriptions[trendStage]}.\n\nKey signals:\n${signalLines}\n\nConfidence: ${confidenceLabel}`;
}

/**
 * Main computation function. Aggregates all activity data, scores every
 * candidate stock, and upserts results into the HotStockScore collection.
 *
 * @returns {Promise<Array>} Array of scored stock objects
 */
async function computeHotScores() {
  const now = new Date();
  const h48 = new Date(now - 48 * 3_600_000);   // current window start
  const h96 = new Date(now - 96 * 3_600_000);   // previous window start

  logger.info('[hotstock] Starting hot score computation');

  // ── 1. Watchlist signals (primary, most reliable) ──────────────────────────
  const [recentAddsRaw, prevAddsRaw, baselineRaw] = await Promise.all([
    WatchlistItem.aggregate([
      { $match: { createdAt: { $gte: h48 } } },
      {
        $group: {
          _id: '$symbol',
          count: { $sum: 1 },
          users: { $addToSet: '$userId' },
        },
      },
    ]),
    WatchlistItem.aggregate([
      { $match: { createdAt: { $gte: h96, $lt: h48 } } },
      { $group: { _id: '$symbol', count: { $sum: 1 } } },
    ]),
    WatchlistItem.aggregate([
      { $match: { isDisabled: false } },
      { $group: { _id: '$symbol', totalWatchers: { $sum: 1 } } },
    ]),
  ]);

  // ── 2. Interaction signals from AuditLog (secondary) ───────────────────────
  // Stocks route logs: watchlist.add, watchlist.remove, stock.viewed,
  // portfolio.set, portfolio.removed, alert.set, alert.removed, note.saved, note.removed
  // All use metadata.symbol field.
  const [recentInterRaw, prevInterRaw] = await Promise.all([
    AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: h48 },
          'actor.type': 'user',
          'metadata.symbol': { $exists: true, $ne: null, $gt: '' },
        },
      },
      {
        $group: {
          _id: '$metadata.symbol',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
    ]),
    AuditLog.aggregate([
      {
        $match: {
          timestamp: { $gte: h96, $lt: h48 },
          'actor.type': 'user',
          'metadata.symbol': { $exists: true, $ne: null, $gt: '' },
        },
      },
      {
        $group: {
          _id: '$metadata.symbol',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // ── 3. Build O(1) lookup maps ───────────────────────────────────────────────
  const recentAdds = Object.fromEntries(
    recentAddsRaw.map((x) => [x._id, { count: x.count, users: x.users.map(String) }])
  );
  const prevAdds = Object.fromEntries(prevAddsRaw.map((x) => [x._id, x.count]));
  const baseline = Object.fromEntries(baselineRaw.map((x) => [x._id, x.totalWatchers]));
  const recentInter = Object.fromEntries(
    recentInterRaw.map((x) => [x._id, { count: x.count, uniqueUsers: x.uniqueUsers.map(String) }])
  );
  const prevInter = Object.fromEntries(prevInterRaw.map((x) => [x._id, x.count]));

  // ── 4. Candidate symbols = union of all data sources ───────────────────────
  const allSymbols = new Set([
    ...Object.keys(recentAdds),
    ...Object.keys(baseline),
    ...Object.keys(recentInter),
  ]);

  if (allSymbols.size === 0) {
    logger.info('[hotstock] No candidate symbols — no platform activity recorded yet');
    return [];
  }

  // ── 5. Load stock metadata (name, sector) ──────────────────────────────────
  const stocks = await Stock.find(
    { ticker: { $in: [...allSymbols] } },
    { ticker: 1, name: 1, sector: 1 }
  ).lean();
  const stockMeta = Object.fromEntries(stocks.map((s) => [s.ticker, s]));

  // ── 6. Score each candidate ─────────────────────────────────────────────────
  const results = [];

  for (const symbol of allSymbols) {
    const ra = recentAdds[symbol] || { count: 0, users: [] };
    const pa = prevAdds[symbol] || 0;
    const tw = baseline[symbol] || 0;
    const ri = recentInter[symbol] || { count: 0, uniqueUsers: [] };
    const pi = prevInter[symbol] || 0;

    const signals = {
      recentAdds_48h: ra.count,
      prevAdds_48h: pa,
      addGrowthRate: parseFloat(growthRate(ra.count, pa).toFixed(4)),
      totalActiveWatchers: tw,
      recentInteractions_48h: ri.count,
      prevInteractions_48h: pi,
      interactionGrowthRate: parseFloat(growthRate(ri.count, pi).toFixed(4)),
      // Unique users = union of watchlist adders + interaction users
      uniqueUsers_48h: new Set([...ra.users, ...ri.uniqueUsers]).size,
    };

    // Momentum dimensions
    const addScore = clamp(signals.addGrowthRate * 40, 0, 40);
    const interScore = clamp(signals.interactionGrowthRate * 35, 0, 35);
    const uniqueScore = clamp((signals.uniqueUsers_48h / Math.max(tw, 1)) * 25, 0, 25);
    const momentumScore = addScore + interScore + uniqueScore;

    // Saturation penalty: max 30-point reduction for already-popular stocks
    const saturationIndex = clamp(tw / 10, 0, 30);

    const rawHotScore = momentumScore - saturationIndex;
    const hotScore = Math.round(clamp(rawHotScore, 0, 100));
    const trendStage = classifyTrend(hotScore);
    const confidence = classifyConfidence(ra.count + ri.count, ra.count);

    const topContributors = [
      {
        name: 'Watchlist Growth',
        value: `${Math.round(signals.addGrowthRate * 100)}%`,
        contribution: Math.round(addScore),
      },
      {
        name: 'Interaction Growth',
        value: `${Math.round(signals.interactionGrowthRate * 100)}%`,
        contribution: Math.round(interScore),
      },
      {
        name: 'Unique User Engagement',
        value: signals.uniqueUsers_48h,
        contribution: Math.round(uniqueScore),
      },
    ].filter((c) => c.contribution > 0);

    const explanation = buildExplanation(signals, trendStage, confidence);
    const meta = stockMeta[symbol] || {};

    results.push({
      symbol,
      name: meta.name || symbol,
      sector: meta.sector || 'Unknown',
      hotScore,
      momentumScore: Math.round(momentumScore),
      saturationIndex: Math.round(saturationIndex),
      trendStage,
      confidence,
      signals,
      topContributors,
      explanation,
      computedAt: now,
    });
  }

  // ── 7. Upsert scores into DB (rolling history) ──────────────────────────────
  const ops = results.map((r) => ({
    updateOne: {
      filter: { symbol: r.symbol },
      update: {
        $set: {
          name: r.name,
          sector: r.sector,
          hotScore: r.hotScore,
          momentumScore: r.momentumScore,
          saturationIndex: r.saturationIndex,
          trendStage: r.trendStage,
          confidence: r.confidence,
          signals: r.signals,
          topContributors: r.topContributors,
          explanation: r.explanation,
          computedAt: r.computedAt,
        },
        $push: {
          scoreHistory: {
            $each: [{ hotScore: r.hotScore, trendStage: r.trendStage, computedAt: now }],
            $slice: -MAX_HISTORY,
          },
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await HotStockScore.bulkWrite(ops);
  }

  logger.info(`[hotstock] Scored ${results.length} symbols`, {
    trending: results.filter((r) => r.trendStage === 'trending').length,
    accelerating: results.filter((r) => r.trendStage === 'accelerating').length,
    emerging: results.filter((r) => r.trendStage === 'emerging').length,
  });

  return results;
}

module.exports = { computeHotScores };
