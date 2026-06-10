/**
 * System-wide automation defaults + small helpers shared by the engine.
 */

// Global per-user fatigue caps (across ALL rules). 0 = unlimited.
const GLOBAL_MAX_PER_DAY = 8;
const GLOBAL_MAX_PER_HOUR = 3;

// Hard ceiling on how many (user × ticker) evaluations a single market rule may
// perform per execution. A misconfigured "watchlist_holders" rule with no ticker
// otherwise walks the whole stock universe × every holder on the 10-min cron;
// the anti-spam gate caps notifications *sent* but not the DB work done getting
// there. A rule may set its own lower `maxFanOut`. 0 on the rule = use this default.
const MARKET_RULE_MAX_FANOUT = 50000;

/** Safe dot-path read: getByPath(ctx, 'stock.analysis.riskScore'). */
function getByPath(obj, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Replace {{token}} placeholders from a flat token map. */
function interpolate(str, tokens = {}) {
  if (!str) return str;
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (tokens[k] != null ? String(tokens[k]) : ''));
}

module.exports = { GLOBAL_MAX_PER_DAY, GLOBAL_MAX_PER_HOUR, MARKET_RULE_MAX_FANOUT, getByPath, interpolate };
