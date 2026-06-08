/**
 * Expectation score refresh cron job.
 * Runs every 6 hours and recomputes expectation scores from cached stock data
 * (no external API calls — uses data already stored from the main cache refresh).
 */

const cron = require('node-cron');
const Stock = require('../models/Stock');
const expectationEngine = require('../engines/expectationEngine');
const logger = require('../utils/logger');

async function refreshExpectationScores() {
  const stocks = await Stock.find({ 'cachedData.price': { $gt: 0 } })
    .select('ticker sector cachedData.price cachedData.analystTargetPrice cachedData.peRatio cachedData.recommendationKey cachedData.historical')
    .lean();

  if (stocks.length === 0) return 0;

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

  await Stock.bulkWrite(ops);
  return stocks.length;
}

// Every 6 hours: 00:00, 06:00, 12:00, 18:00
cron.schedule('0 */6 * * *', async () => {
  logger.info('[expectation-cron] Starting expectation score refresh');
  try {
    const count = await refreshExpectationScores();
    logger.info(`[expectation-cron] Completed — refreshed ${count} stocks`);
  } catch (err) {
    logger.error('[expectation-cron] Refresh failed', { err: err.message });
  }
});

logger.info('[expectation-cron] Registered — runs every 6 hours');
