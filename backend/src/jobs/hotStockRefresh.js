/**
 * Hot Stock Score refresh cron job.
 * Runs every 6 hours to recompute momentum scores for all tracked stocks.
 * Separated from the main cache refresh job to avoid interfering with
 * the existing watchlist/analysis pipeline.
 */

const cron = require('node-cron');
const { computeHotScores } = require('../services/hotStockService');
const logger = require('../utils/logger');

// Every 6 hours: 00:00, 06:00, 12:00, 18:00
cron.schedule('0 */6 * * *', async () => {
  logger.info('[hotstock-cron] Starting scheduled hot stock score computation');
  try {
    const results = await computeHotScores();
    logger.info(`[hotstock-cron] Completed — scored ${results?.length ?? 0} symbols`);
  } catch (err) {
    logger.error('[hotstock-cron] Computation failed', { err: err.message });
  }
});

logger.info('[hotstock-cron] Registered — runs every 6 hours');
