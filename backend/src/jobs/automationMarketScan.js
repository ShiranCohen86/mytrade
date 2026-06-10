/**
 * Market trigger scan — every 10 minutes on weekdays. Loads active market-class
 * rules, builds the ticker universe (explicit params ∪ all watchlist tickers),
 * batch-loads stock/hot/index data once, then evaluates each rule via the engine.
 */
const cron = require('node-cron');
const AutomationRule = require('../models/AutomationRule');
const registry = require('../automation/registry');
const engine = require('../automation/automationEngine');
const dataLoader = require('../automation/dataLoader');
const { withCronLock } = require('../utils/cronLock');
const logger = require('../utils/logger');

let isRunning = false;
let lastRegime = null;

async function scan() {
  if (isRunning) return;
  isRunning = true;
  try {
    const rules = await AutomationRule.find({ status: 'active' }).lean();
    const market = [];
    const marketLevel = [];
    for (const r of rules) {
      const t = registry.get(r.trigger.type);
      if (!t || t.feasible === false) continue;
      if (t.evaluatorClass === 'market') market.push(r);
      else if (t.evaluatorClass === 'market_level') marketLevel.push(r);
    }
    if (!market.length && !marketLevel.length) return;

    const allUsers = await dataLoader.loadActiveUsers();

    const explicit = [];
    let needWatchlist = false;
    for (const r of market) {
      const tk = r.trigger.params && r.trigger.params.ticker;
      if (tk) explicit.push(String(tk).toUpperCase()); else needWatchlist = true;
      if (r.targeting.mode === 'watchlist_holders') needWatchlist = true;
    }
    const wl = needWatchlist ? await dataLoader.allWatchlistTickers() : [];
    const data = await dataLoader.loadMarketData([...explicit, ...wl]);

    data.market.regime = dataLoader.deriveRegime(data.market);
    data.market.regimeChanged = lastRegime != null && lastRegime !== data.market.regime;
    lastRegime = data.market.regime;

    let fired = 0;
    for (const r of market) { const res = await engine.runMarketRule(r, data, allUsers); fired += res.filter((x) => x && x.outcome === 'sent').length; }
    for (const r of marketLevel) { const res = await engine.runMarketLevelRule(r, data.market, allUsers); fired += res.filter((x) => x && x.outcome === 'sent').length; }
    if (fired) logger.info(`[automation-market] fired ${fired} notification(s) across ${market.length + marketLevel.length} rule(s)`);
  } catch (err) {
    logger.error('[automation-market] scan failed', { err: err.message });
  } finally {
    isRunning = false;
  }
}

cron.schedule('*/10 * * * 1-5', () => withCronLock('automation-market', 9 * 60 * 1000, scan));
logger.info('[automation-market] Registered — every 10 min on weekdays');

module.exports = { scan };
