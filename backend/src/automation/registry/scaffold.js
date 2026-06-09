/* Scaffolded triggers — visible in the builder but inactive until a data source
   is wired. feasible=false → never fire; rules created from these are forced to
   status='inactive'. */
const stub = (key, category, label) => ({
  key, category, evaluatorClass: 'market', feasible: false,
  label, description: 'Needs an external data source',
  paramSchema: [], match: () => false,
  defaults: () => ({ title: '', message: '', type: 'info', icon: 'ℹ️', deepLink: '/dashboard', actionText: '' }),
  dedupeKey: () => key,
});

module.exports = [
  stub('insider_activity', 'watchlist_stock', 'Insider activity'),
  stub('institutional_activity', 'watchlist_stock', 'Institutional activity'),
  stub('fed_announcement', 'market', 'Federal Reserve announcement'),
  stub('cpi_release', 'market', 'CPI release'),
  stub('gdp_release', 'market', 'GDP release'),
  stub('employment_report', 'market', 'Employment report'),
  stub('econ_calendar_event', 'market', 'Economic calendar event'),
];
