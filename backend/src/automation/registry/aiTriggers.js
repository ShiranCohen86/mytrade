/* AI personalization triggers. Mix of per-ticker (market) + user. ctx as in stock/user. */
const h = require('./helpers');
const link = '/stocks/{{ticker}}';

module.exports = [
  // ── Feasible (pure Stock.analysis) ────────────────────────────────────────
  {
    key: 'ai_opportunity', category: 'ai_personalization', evaluatorClass: 'market', feasible: true,
    label: 'AI opportunity detection', description: 'High expectation + low risk',
    paramSchema: [{ name: 'minExpectation', type: 'number', default: 70, label: 'Expectation ≥' }, { name: 'maxRisk', type: 'number', default: 45, label: 'Risk ≤' }],
    match: (c, p) => h.an(c.stock).expectationScore >= Number(p.minExpectation || 70) && h.an(c.stock).riskScore <= Number(p.maxRisk || 45),
    defaults: () => ({ title: '💡 Opportunity: {{ticker}}', message: '{{ticker}} scores high on expectation with low risk.', type: 'success', icon: '💡', deepLink: link, actionText: 'View {{ticker}}' }),
    dedupeKey: (c) => `${c.ticker}:opp:${h.today()}`,
  },
  {
    key: 'ai_risk', category: 'ai_personalization', evaluatorClass: 'market', feasible: true,
    label: 'AI risk detection', description: 'Risk score crosses high',
    paramSchema: [{ name: 'minRisk', type: 'number', default: 75, label: 'Risk ≥' }],
    match: (c, p) => h.an(c.stock).riskScore >= Number(p.minRisk || 75),
    defaults: () => ({ title: '⚠️ Elevated risk: {{ticker}}', message: '{{ticker}} risk score is high right now — review your position.', type: 'warning', icon: '⚠️', deepLink: link, actionText: 'Review' }),
    dedupeKey: (c) => `${c.ticker}:airisk:${h.today()}`,
  },
  {
    key: 'watchlist_recommendation', category: 'ai_personalization', evaluatorClass: 'user', feasible: true,
    label: 'AI watchlist recommendation', description: 'Suggest a hot stock in a sector the user follows',
    paramSchema: [],
    match: (c) => !!c.recommendation,
    defaults: () => ({ title: 'A stock you might like', message: 'Based on your watchlist, {{ticker}} is gaining momentum.', type: 'info', icon: '✨', deepLink: link, actionText: 'View {{ticker}}' }),
    dedupeKey: (c) => `wlrec:${c.recommendation && c.recommendation.ticker}:${h.today()}`,
  },

  // ── Scaffold (needs view-history / cross-ticker joins) ────────────────────
  ...['similar_stock_trending', 'viewed_stock_moved', 'viewed_stock_news', 'personalized_recommendation'].map((key) => ({
    key, category: 'ai_personalization', evaluatorClass: 'user', feasible: false,
    label: key.replace(/_/g, ' '), description: 'Needs view-history pipeline',
    paramSchema: [], match: () => false,
    defaults: () => ({ title: '', message: '', type: 'info', icon: '✨', deepLink: '/dashboard', actionText: '' }),
    dedupeKey: () => key,
  })),
];
