/**
 * User trigger scan — hourly. Evaluates user-behavior rules (inactivity,
 * onboarding gaps, no-watchlist, notifications/PWA nudges, returned, AI watchlist
 * recommendation) against all active users.
 */
const cron = require('node-cron');
const AutomationRule = require('../models/AutomationRule');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const HotStockScore = require('../models/HotStockScore');
const sectorService = require('../services/sectorService');
const registry = require('../automation/registry');
const engine = require('../automation/automationEngine');
const dataLoader = require('../automation/dataLoader');
const { withCronLock } = require('../utils/cronLock');
const logger = require('../utils/logger');

let isRunning = false;

/** Per-user "a hot stock in a sector you follow, not yet in your watchlist". */
async function buildRecommendations(allUsers) {
  const map = new Map();
  try {
    const hot = await HotStockScore.find({ trendStage: { $in: ['trending', 'accelerating'] } })
      .select('ticker').sort({ hotScore: -1 }).limit(50).lean();
    const hotWithSector = hot.map((h) => ({ ticker: h.ticker, sector: sectorService.getSector(h.ticker) }));
    for (const user of allUsers) {
      const wl = new Set(user.watchlist || []);
      if (!wl.size) continue;
      const userSectors = new Set([...wl].map((t) => sectorService.getSector(t)));
      const pick = hotWithSector.find((h) => userSectors.has(h.sector) && !wl.has(h.ticker));
      if (pick) map.set(String(user._id), pick);
    }
  } catch (err) { logger.warn('[automation-user] recommendations failed', { err: err.message }); }
  return map;
}

async function scan() {
  if (isRunning) return;
  isRunning = true;
  try {
    const rules = (await AutomationRule.find({ status: 'active' }).lean())
      .filter((r) => { const t = registry.get(r.trigger.type); return t && t.feasible !== false && t.evaluatorClass === 'user'; });
    if (!rules.length) return;

    const allUsers = await dataLoader.loadActiveUsers();
    const flags = await dataLoader.loadUserFlags(allUsers.map((u) => u._id));

    // "Returned after inactivity" — recent USER_RETURNED analytics events.
    let returnedSet = new Set();
    if (rules.some((r) => r.trigger.type === 'user_returned')) {
      const ids = await AnalyticsEvent.distinct('userId', { event: 'USER_RETURNED', ts: { $gte: new Date(Date.now() - 90 * 60 * 1000) } });
      returnedSet = new Set(ids.map(String));
    }
    const recommendations = rules.some((r) => r.trigger.type === 'watchlist_recommendation')
      ? await buildRecommendations(allUsers) : new Map();

    let fired = 0;
    for (const r of rules) {
      const res = await engine.runUserRule(r, allUsers, flags, { returnedSet, recommendations });
      fired += res.filter((x) => x && x.outcome === 'sent').length;
    }
    if (fired) logger.info(`[automation-user] fired ${fired} notification(s) across ${rules.length} rule(s)`);
  } catch (err) {
    logger.error('[automation-user] scan failed', { err: err.message });
  } finally {
    isRunning = false;
  }
}

cron.schedule('0 * * * *', () => withCronLock('automation-user', 55 * 60 * 1000, scan)); // hourly
logger.info('[automation-user] Registered — hourly');

module.exports = { scan };
