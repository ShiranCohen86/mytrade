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
    window: t.window || null,
  }));
}

module.exports = { get, list, listByClass, catalog };
