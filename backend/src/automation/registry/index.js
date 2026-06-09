/**
 * Trigger registry — aggregates every trigger definition into a lookup by key,
 * and exposes a serializable catalog (metadata only, no functions) for the admin
 * rule-builder UI.
 */
const all = [
  ...require('./stockTriggers'),
  ...require('./marketTriggers'),
  ...require('./userTriggers'),
  ...require('./aiTriggers'),
  ...require('./platformTriggers'),
  ...require('./engagementTriggers'),
  ...require('./scaffold'),
];

const byKey = new Map(all.map((t) => [t.key, t]));

// ── Template variables ({{token}}) available per trigger, for the rule builder ──
// The recipient (user) is present in every eval context, so user tokens are
// always offered; stock/market tokens depend on the trigger's evaluator class.
const USER_TOKENS = [
  { token: 'firstName', label: "Recipient's first name" },
  { token: 'userName', label: "Recipient's full name" },
  { token: 'email', label: "Recipient's email" },
];
const STOCK_TOKENS = [
  { token: 'ticker', label: 'Stock symbol' },
  { token: 'name', label: 'Company name' },
  { token: 'price', label: 'Current price' },
  { token: 'changePercent', label: 'Daily change %' },
  { token: 'targetPrice', label: 'Configured target price' },
  { token: 'value', label: 'Trigger value (rating / target / %)' },
];
const MARKET_TOKENS = [
  { token: 'index', label: 'Index symbol (e.g. SPY)' },
  { token: 'changePercent', label: 'Index change %' },
  { token: 'value', label: 'Trigger value (VIX / regime)' },
];

/** Notification template variables available for a given trigger definition. */
function tokensFor(t) {
  let base = [];
  if (t.evaluatorClass === 'market') base = STOCK_TOKENS;
  else if (t.evaluatorClass === 'market_level') base = MARKET_TOKENS;
  return [...base, ...USER_TOKENS];
}

function get(key) { return byKey.get(key) || null; }
function list() { return all; }
function listByClass(cls) { return all.filter((t) => t.evaluatorClass === cls); }

/** Metadata-only catalog grouped by category — safe to send to the client. */
function catalog() {
  return all.map((t) => ({
    key: t.key,
    category: t.category,
    evaluatorClass: t.evaluatorClass,
    feasible: t.feasible !== false,
    label: t.label,
    description: t.description,
    paramSchema: t.paramSchema || [],
    tokens: tokensFor(t),
    window: t.window || null,
  }));
}

module.exports = { get, list, listByClass, catalog, tokensFor };
