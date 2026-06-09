/**
 * Universe sync cron — ensures all ~420 tracked universe stocks have fresh
 * expectation scores, regardless of whether users have added them to watchlists.
 *
 * Schedule: daily at 02:00 UTC (market closed, low Yahoo rate-limit pressure).
 * Each run analyzes up to MAX_PER_RUN stocks in batches of 3 (same throttle as
 * cacheRefresh). Prioritises: never-analyzed stocks first, then 7-day stale.
 */

const cron = require('node-cron');
const Stock = require('../models/Stock');
const stockService = require('../services/stockService');
const logger = require('../utils/logger');
const tickerDiscovery = require('../services/tickerDiscovery');

const MAX_PER_RUN = 60;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function pLimit(concurrency) {
  const { default: fn } = await import('p-limit');
  return fn(concurrency);
}

async function syncUniverseStocks() {
  // Dynamic universe: static list + user watchlists + audit log + validated discoveries
  const universeSet = await tickerDiscovery.getAllTickers();
  const UNIVERSE = [...universeSet];

  const existing = await Stock.find({ ticker: { $in: UNIVERSE } })
    .select('ticker analysis.analyzedAt')
    .lean();

  const analyzedMap = new Map(existing.map((s) => [s.ticker, s.analysis?.analyzedAt ?? null]));
  const now = Date.now();

  const neverAnalyzed = UNIVERSE.filter((t) => !analyzedMap.has(t) || analyzedMap.get(t) === null);
  const stale = UNIVERSE.filter((t) => {
    const at = analyzedMap.get(t);
    return at && (now - new Date(at).getTime()) > STALE_MS;
  });

  const needsAnalysis = [...neverAnalyzed, ...stale];

  if (needsAnalysis.length === 0) {
    logger.info('[universe-sync] All universe stocks are up to date');
    return 0;
  }

  const batch = needsAnalysis.slice(0, MAX_PER_RUN);
  logger.info(`[universe-sync] Analyzing ${batch.length} / ${needsAnalysis.length} pending (${neverAnalyzed.length} new, ${stale.length} stale)`);

  const limit = await pLimit(3);
  let success = 0;
  let failed = 0;

  await Promise.allSettled(
    batch.map((ticker) =>
      limit(async () => {
        try {
          await stockService.analyzeStock(ticker);
          success++;
        } catch (err) {
          failed++;
          logger.warn(`[universe-sync] ✗ ${ticker}: ${err.message}`);
        }
      })
    )
  );

  logger.info(`[universe-sync] Done — ✓ ${success}  ✗ ${failed}`);
  return success;
}

let isRunning = false;

// Daily at 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  if (isRunning) {
    logger.warn('[universe-sync] Previous run still in progress — skipping');
    return;
  }
  isRunning = true;
  const t0 = Date.now();
  logger.info('[universe-sync] Starting nightly universe sync');
  try {
    const count = await syncUniverseStocks();
    const mins = ((Date.now() - t0) / 60_000).toFixed(1);
    logger.info(`[universe-sync] Completed — ${count} stocks analyzed in ${mins}m`);
  } catch (err) {
    logger.error('[universe-sync] Failed', { err: err.message });
  } finally {
    isRunning = false;
  }
});

// On startup: log coverage diagnostics without triggering any analysis
tickerDiscovery.getAllTickers()
  .then((set) => Stock.countDocuments({ ticker: { $in: [...set] } })
    .then((found) => {
      logger.info(`[universe-sync] Coverage: ${found}/${set.size} universe stocks in DB`);
    })
  )
  .catch(() => {});

logger.info('[universe-sync] Registered — runs daily at 02:00 UTC');

// Export for on-demand use (e.g. admin intelligence refresh)
module.exports = { syncUniverseStocks };
