/* Engagement digests. evaluatorClass='scheduled' — produced by automationDigestFlush. */
const mk = (key, label, description, window, icon, title) => ({
  key, category: 'engagement', evaluatorClass: 'scheduled', feasible: true,
  label, description, window,
  paramSchema: [{ name: 'sendTime', type: 'text', default: '09:35', label: 'Send time (HH:MM ET)' }],
  match: () => true,
  defaults: () => ({ title, message: '{{summary}}', type: 'info', icon, deepLink: '/dashboard', actionText: 'Open dashboard' }),
  dedupeKey: (c) => `${key}:${c.user && c.user._id}:${new Date().toISOString().slice(0, 10)}`,
});

module.exports = [
  mk('daily_digest', 'Daily digest', 'Once-a-day watchlist summary', 'daily', '🗞️', 'Your daily market digest'),
  mk('weekly_digest', 'Weekly digest', 'Weekly watchlist recap', 'weekly', '📅', 'Your week in markets'),
  mk('monthly_digest', 'Monthly digest', 'Monthly performance review', 'monthly', '📆', 'Your month in markets'),
  mk('watchlist_summary', 'Watchlist summary', 'Snapshot of your watchlist', 'daily', '⭐', 'Your watchlist summary'),
  mk('missed_opportunities', 'Missed opportunities', 'Stocks you watched that moved', 'weekly', '🪙', 'Opportunities you may have missed'),
  mk('market_recap', 'Personalized market recap', 'Personalized recap of the day', 'daily', '🌅', 'Today’s market recap'),
];
