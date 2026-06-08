const cron = require('node-cron');
const config = require('../config');
const { User } = require('../db');
const stockService = require('../services/stockService');
const logger = require('../utils/logger');

// p-limit is ESM-only in v6+; dynamic import keeps this file CommonJS
async function pLimit(concurrency) {
  const { default: pLimitFn } = await import('p-limit');
  return pLimitFn(concurrency);
}

const CRON_VALID_RE = /^(\S+\s){4}\S+$/;
const cronSchedule = CRON_VALID_RE.test(config.CRON_SCHEDULE)
  ? config.CRON_SCHEDULE
  : (logger.warn(`Invalid CRON_SCHEDULE "${config.CRON_SCHEDULE}" — using default "0 */2 * * *"`), '0 */2 * * *');

let isRunning = false;

cron.schedule(cronSchedule, async () => {
  if (isRunning) {
    logger.warn('Previous cron run still in progress — skipping this tick');
    return;
  }
  isRunning = true;
  const startTime = Date.now();
  logger.info('Running watchlist refresh');
  try {
    // Collect all unique tickers across all users — Stock docs are shared,
    // so refreshing each ticker once keeps all users up-to-date.
    const users = await User.find({ 'watchlist.0': { $exists: true } }).select('watchlist').lean();
    if (!users.length) return;

    const allTickers = [...new Set(users.flatMap((u) => u.watchlist))];
    if (!allTickers.length) return;

    const limit = await pLimit(3); // max 3 concurrent analyses to avoid Yahoo rate limits

    const results = await Promise.allSettled(
      allTickers.map((ticker) => limit(() => stockService.analyzeStock(ticker)))
    );

    let success = 0;
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        success++;
      } else {
        failed++;
        logger.error(`Failed to refresh ${allTickers[i]}`, { err: r.reason?.message });
      }
    });

    const durationS = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('Watchlist refresh complete', { success, failed, total: allTickers.length, durationS });
    if (Date.now() - startTime > 30 * 60 * 1000) {
      logger.warn('Cron refresh took longer than 30 minutes');
    }
  } catch (err) {
    logger.error('Cron error', { err: err.message });
  } finally {
    isRunning = false;
  }
});

logger.info(`Cron scheduled with: ${cronSchedule}`);
