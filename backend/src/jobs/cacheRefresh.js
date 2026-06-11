const cron = require('node-cron');
const config = require('../config');
const { User, Stock } = require('../db');
const stockService = require('../services/stockService');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('../utils/emailService');
const { withCronLock } = require('../utils/cronLock');
const pushService = require('../services/pushService');

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours between repeat emails

async function checkPriceAlerts(tickers) {
  try {
    const stocks = await Stock.find({ ticker: { $in: tickers } })
      .select('ticker cachedData.price')
      .lean();

    const priceMap = {};
    stocks.forEach((s) => {
      if (s.cachedData?.price != null) priceMap[s.ticker] = s.cachedData.price;
    });

    const users = await User.find({ 'priceAlerts.ticker': { $in: tickers } })
      .select('email displayName priceAlerts')
      .lean();

    const now = Date.now();

    for (const user of users) {
      // Push is the primary alert channel; email is a fallback only for users who
      // can't receive a price-alert push. Anyone with an active price_alert
      // subscription is served by alertScan (push) — skip them here so the two
      // channels don't double-notify or fight over the shared cooldown.
      if (await pushService.countForUser(user._id, 'price_alert') > 0) continue;

      for (const alert of user.priceAlerts) {
        const currentPrice = priceMap[alert.ticker];
        if (currentPrice == null) continue;

        const triggered =
          alert.direction === 'above'
            ? currentPrice >= alert.targetPrice
            : currentPrice <= alert.targetPrice;
        if (!triggered) continue;

        const lastSent = alert.lastAlertNotifiedAt
          ? new Date(alert.lastAlertNotifiedAt).getTime()
          : 0;
        if (now - lastSent < ALERT_COOLDOWN_MS) continue;

        try {
          await sendAlertEmail(user, alert.ticker, alert, currentPrice);
          await User.updateOne(
            { _id: user._id },
            { $set: { 'priceAlerts.$[el].lastAlertNotifiedAt': new Date() } },
            {
              arrayFilters: [
                {
                  'el.ticker': alert.ticker,
                  'el.direction': alert.direction,
                  'el.targetPrice': alert.targetPrice,
                },
              ],
            }
          );
          logger.info('Price alert sent', {
            email: user.email,
            ticker: alert.ticker,
            direction: alert.direction,
            target: alert.targetPrice,
            current: currentPrice,
          });
        } catch (emailErr) {
          logger.error('Failed to send price alert email', {
            email: user.email,
            ticker: alert.ticker,
            err: emailErr.message,
          });
        }
      }
    }
  } catch (err) {
    logger.error('checkPriceAlerts error', { err: err.message });
  }
}

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

// Outer withCronLock guards against concurrent runs across *processes* (multi-instance
// deploys); the inner isRunning flag guards against overlap within a single process.
// Without the distributed lock every instance would refresh the whole watchlist in
// parallel, multiplying Yahoo load and risking rate limits.
const REFRESH_LOCK_TTL_MS = 30 * 60 * 1000; // matches the 30-min overrun warning below

cron.schedule(cronSchedule, () => withCronLock('watchlist-refresh', REFRESH_LOCK_TTL_MS, async () => {
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
    const refreshedTickers = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        success++;
        refreshedTickers.push(allTickers[i]);
      } else {
        failed++;
        logger.error(`Failed to refresh ${allTickers[i]}`, { err: r.reason?.message });
      }
    });

    const durationS = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('Watchlist refresh complete', { success, failed, total: allTickers.length, durationS });

    if (refreshedTickers.length > 0) {
      await checkPriceAlerts(refreshedTickers);
    }
    if (Date.now() - startTime > 30 * 60 * 1000) {
      logger.warn('Cron refresh took longer than 30 minutes');
    }
  } catch (err) {
    logger.error('Cron error', { err: err.message });
  } finally {
    isRunning = false;
  }
}));

logger.info(`Cron scheduled with: ${cronSchedule}`);
