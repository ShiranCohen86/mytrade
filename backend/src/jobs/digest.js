/**
 * Daily re-engagement push: a market-open digest (your watchlist's biggest mover)
 * and an earnings-tomorrow reminder. Runs once on weekday mornings. Only users
 * who opted into the respective category receive each notification.
 */
const cron = require('node-cron');
const User = require('../models/User');
const Stock = require('../models/Stock');
const PushSubscription = require('../models/PushSubscription');
const pushService = require('../services/pushService');
const logger = require('../utils/logger');

async function sendDailyDigest() {
  if (!pushService.isPushEnabled()) return { digest: 0, earnings: 0 };

  const [digestUserIds, earningsUserIds] = await Promise.all([
    PushSubscription.distinct('userId', { categories: 'digest' }),
    PushSubscription.distinct('userId', { categories: 'earnings' }),
  ]);
  const digestSet = new Set(digestUserIds.map(String));
  const earningsSet = new Set(earningsUserIds.map(String));
  const allIds = [...new Set([...digestSet, ...earningsSet])];
  if (!allIds.length) return { digest: 0, earnings: 0 };

  const users = await User.find({ _id: { $in: allIds }, isSuspended: { $ne: true } })
    .select('_id watchlist')
    .lean();

  const tickers = [...new Set(users.flatMap((u) => u.watchlist || []))];
  const data = {};
  if (tickers.length) {
    const stocks = await Stock.find({ ticker: { $in: tickers } })
      .select('ticker cachedData.changePercent cachedData.earningsDate')
      .lean();
    stocks.forEach((s) => { data[s.ticker] = s.cachedData || {}; });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 36 * 60 * 60 * 1000); // ~next session + buffer
  let digestSent = 0;
  let earningsSent = 0;

  for (const u of users) {
    const wl = u.watchlist || [];
    if (!wl.length) continue;
    const uid = String(u._id);

    if (digestSet.has(uid)) {
      let top = null;
      for (const t of wl) {
        const cp = data[t] && data[t].changePercent;
        if (cp == null) continue;
        if (!top || Math.abs(cp) > Math.abs(top.cp)) top = { t, cp };
      }
      if (top) {
        const sign = top.cp >= 0 ? '+' : '';
        const r = await pushService.sendToUser(u._id, 'digest', {
          title: 'Your watchlist today',
          body: `${top.t} is leading at ${sign}${top.cp.toFixed(2)}%. Tap to see your full watchlist.`,
          url: '/dashboard?source=digest',
          tag: 'daily-digest',
        });
        if (r.sent) digestSent += 1;
      }
    }

    if (earningsSet.has(uid)) {
      const soon = wl.filter((t) => {
        const ed = data[t] && data[t].earningsDate;
        if (!ed) return false;
        const d = new Date(ed);
        return d >= now && d <= horizon;
      });
      if (soon.length) {
        const r = await pushService.sendToUser(u._id, 'earnings', {
          title: soon.length === 1 ? `${soon[0]} reports earnings soon` : `${soon.length} of your stocks report soon`,
          body: soon.length === 1
            ? `${soon[0]} is scheduled to report within ~24h.`
            : `${soon.slice(0, 3).join(', ')}${soon.length > 3 ? '…' : ''} report within ~24h.`,
          url: '/dashboard?source=earnings',
          tag: 'earnings-reminder',
        });
        if (r.sent) earningsSent += 1;
      }
    }
  }
  return { digest: digestSent, earnings: earningsSent };
}

// Weekday mornings ~09:35 ET (13:35 UTC); slightly after the US open.
cron.schedule('35 13 * * 1-5', async () => {
  logger.info('[digest] running daily digest');
  try {
    const r = await sendDailyDigest();
    logger.info(`[digest] sent ${r.digest} digest(s), ${r.earnings} earnings reminder(s)`);
  } catch (err) {
    logger.error('[digest] failed', { err: err.message });
  }
});

logger.info('[digest] Registered — weekdays 13:35 UTC');

module.exports = { sendDailyDigest };
