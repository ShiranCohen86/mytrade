/**
 * Digest flush — runs once each weekday morning (≈9:35 ET). Two jobs:
 *  1. Combine batched trigger fires (DigestBucket) into ONE notification per user
 *     per window ("3 stocks in your watchlist moved significantly today").
 *  2. Run scheduled engagement rules (daily/weekly/monthly digests) by generating
 *     a per-user watchlist summary and firing through the engine.
 */
const cron = require('node-cron');
const DigestBucket = require('../models/DigestBucket');
const AutomationRule = require('../models/AutomationRule');
const Stock = require('../models/Stock');
const registry = require('../automation/registry');
const engine = require('../automation/automationEngine');
const dataLoader = require('../automation/dataLoader');
const notificationService = require('../services/notificationService');
const { withCronLock } = require('../utils/cronLock');
const logger = require('../utils/logger');

async function flushBuckets(window) {
  const buckets = await DigestBucket.find({ window }).select('_id').lean();
  let sent = 0;
  for (const { _id } of buckets) {
    // Atomically claim the current items and reset the bucket to empty. Anything
    // pushed *during* this flush lands in the now-empty array and survives to the
    // next flush, instead of being lost to a read-then-delete race.
    const claimed = await DigestBucket.findOneAndUpdate( // eslint-disable-line no-await-in-loop
      { _id }, { $set: { items: [] } }, { new: false }
    ).lean();
    const items = (claimed && claimed.items) || [];
    // Drop the bucket only while it is still empty (filter guards against a push
    // that arrived after the reset above).
    if (!items.length) { await DigestBucket.deleteOne({ _id, items: { $size: 0 } }); continue; } // eslint-disable-line no-await-in-loop

    const n = items.length;
    const tickers = [...new Set(items.map((i) => i.ticker).filter(Boolean))];
    const title = n === 1 ? items[0].title : `${tickers.length || n} updates in your watchlist`;
    const message = n === 1
      ? items[0].message
      : `${items.slice(0, 4).map((i) => i.title).join(' · ')}${n > 4 ? ` and ${n - 4} more` : ''}`;
    await notificationService.deliverToUser(claimed.userId, // eslint-disable-line no-await-in-loop
      { title, message, type: 'info', icon: '🗞️', deepLink: '/notifications', actionText: 'View all' },
      { inApp: true, push: true }, { tag: `digest-${window}` });
    await DigestBucket.deleteOne({ _id, items: { $size: 0 } }); // eslint-disable-line no-await-in-loop
    sent += 1;
  }
  return sent;
}

async function buildWatchlistSummary(user) {
  const wl = user.watchlist || [];
  if (!wl.length) return null;
  const stocks = await Stock.find({ ticker: { $in: wl } }).select('ticker cachedData.changePercent').lean();
  const movers = stocks
    .filter((s) => s.cachedData && s.cachedData.changePercent != null)
    .sort((a, b) => Math.abs(b.cachedData.changePercent) - Math.abs(a.cachedData.changePercent));
  if (!movers.length) return null;
  const top = movers.slice(0, 3).map((s) => `${s.ticker} ${s.cachedData.changePercent > 0 ? '+' : ''}${s.cachedData.changePercent.toFixed(1)}%`);
  return `${top.join(', ')}${movers.length > 3 ? ` and ${movers.length - 3} more moved` : ''}.`;
}

async function runScheduled(windowSet) {
  const rules = (await AutomationRule.find({ status: 'active' }).lean())
    .filter((r) => { const t = registry.get(r.trigger.type); return t && t.feasible !== false && t.evaluatorClass === 'scheduled' && windowSet.has(t.window || 'daily'); });
  if (!rules.length) return 0;

  const allUsers = await dataLoader.loadActiveUsers();
  const byId = new Map(allUsers.map((u) => [String(u._id), u]));
  let fired = 0;
  for (const rule of rules) {
    const targetIds = (await engine.resolveTargetUserIds(rule, byId)) || [...byId.keys()]; // eslint-disable-line no-await-in-loop
    for (const id of targetIds) {
      const user = byId.get(id);
      if (!user) continue;
      const summary = await buildWatchlistSummary(user); // eslint-disable-line no-await-in-loop
      if (!summary) continue;
      const r = await engine.fireOne(rule, user, { user, summary }, {}); // eslint-disable-line no-await-in-loop
      if (r && r.outcome === 'sent') fired += 1;
    }
  }
  return fired;
}

async function run() {
  try {
    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isFirst = now.getUTCDate() <= 3 && isMonday; // first Monday ≈ monthly
    const windows = new Set(['daily']);
    if (isMonday) windows.add('weekly');
    if (isFirst) windows.add('monthly');

    let total = await flushBuckets('daily');
    if (isMonday) total += await flushBuckets('weekly');
    total += await runScheduled(windows);
    if (total) logger.info(`[automation-digest] delivered ${total} digest(s)`);
  } catch (err) {
    logger.error('[automation-digest] failed', { err: err.message });
  }
}

cron.schedule('35 13 * * 1-5', () => withCronLock('automation-digest', 20 * 60 * 1000, run)); // ~9:35 AM ET on weekdays
logger.info('[automation-digest] Registered — weekday mornings');

module.exports = { run, flushBuckets };
