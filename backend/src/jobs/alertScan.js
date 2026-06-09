/**
 * Price-alert delivery scan. Every 5 minutes on weekdays it checks each user's
 * stored price alerts against the latest price and sends a Web Push notification
 * when a threshold is crossed — finally delivering alerts that were previously
 * stored but never sent. A 24h per-alert cooldown (lastAlertNotifiedAt) prevents
 * repeat spam while the price stays across the threshold.
 */
const cron = require('node-cron');
const User = require('../models/User');
const Stock = require('../models/Stock');
const provider = require('../providers/ProviderFactory');
const pushService = require('../services/pushService');
const logger = require('../utils/logger');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function scanAlerts() {
  if (!pushService.isPushEnabled()) return 0;

  const users = await User.find({ 'priceAlerts.0': { $exists: true }, isSuspended: { $ne: true } })
    .select('_id priceAlerts')
    .lean();
  if (!users.length) return 0;

  const tickers = [...new Set(users.flatMap((u) => u.priceAlerts.map((a) => a.ticker)))];

  // Prefer cached prices; fill any gaps from the live provider (best-effort).
  const priceMap = {};
  const cached = await Stock.find({ ticker: { $in: tickers } }).select('ticker cachedData.price').lean();
  cached.forEach((s) => { if (s.cachedData && s.cachedData.price) priceMap[s.ticker] = s.cachedData.price; });
  await Promise.all(
    tickers.filter((t) => priceMap[t] == null).map(async (t) => {
      try {
        const q = await provider.getCurrentQuote(t);
        if (q && q.price) priceMap[t] = q.price;
      } catch { /* ignore — alert just won't evaluate this tick */ }
    })
  );

  const now = Date.now();
  let fired = 0;

  for (const u of users) {
    const setObj = {};
    for (let i = 0; i < u.priceAlerts.length; i += 1) {
      const a = u.priceAlerts[i];
      const price = priceMap[a.ticker];
      if (price == null || a.targetPrice == null) continue;

      const crossed = a.direction === 'below' ? price <= a.targetPrice : price >= a.targetPrice;
      if (!crossed) continue;

      const last = a.lastAlertNotifiedAt ? new Date(a.lastAlertNotifiedAt).getTime() : 0;
      if (now - last < COOLDOWN_MS) continue;

      const verb = a.direction === 'below' ? 'dropped to' : 'reached';
      await pushService.sendToUser(u._id, 'price_alert', {
        title: `${a.ticker} ${verb} $${a.targetPrice}`,
        body: `${a.ticker} is now $${Number(price).toFixed(2)} — your price alert triggered.`,
        url: `/stocks/${a.ticker}`,
        tag: `alert-${a.ticker}`,
        urgency: 'high',
        requireInteraction: true,
      });
      setObj[`priceAlerts.${i}.lastAlertNotifiedAt`] = new Date();
      fired += 1;
    }
    if (Object.keys(setObj).length) {
      await User.updateOne({ _id: u._id }, { $set: setObj }).catch(() => {});
    }
  }
  return fired;
}

cron.schedule('*/5 * * * 1-5', async () => {
  try {
    const n = await scanAlerts();
    if (n) logger.info(`[alert-scan] fired ${n} price alert(s)`);
  } catch (err) {
    logger.error('[alert-scan] failed', { err: err.message });
  }
});

logger.info('[alert-scan] Registered — every 5 min on weekdays');

module.exports = { scanAlerts };
