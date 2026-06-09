/* Platform announcements. evaluatorClass='event' — admin-fired (run-now / handleEvent). match=true. */
const mk = (key, label, icon, type, title, message) => ({
  key, category: 'platform', evaluatorClass: 'event', feasible: true,
  label, description: 'Admin-fired announcement',
  paramSchema: [],
  match: () => true,
  defaults: () => ({ title, message, type, icon, deepLink: '/dashboard', actionText: 'Learn more' }),
  dedupeKey: (c, p, runId) => `${key}:${runId || new Date().toISOString().slice(0, 10)}`,
});

module.exports = [
  mk('feature_launch', 'New feature launch', '✨', 'success', 'New feature available ✨', 'We just shipped something new — check it out.'),
  mk('new_version', 'New version available', '🆕', 'info', 'MyTrade just got better', 'A new version is live with improvements and fixes.'),
  mk('maintenance_notice', 'Maintenance notice', '🛠️', 'warning', 'Scheduled maintenance', 'MyTrade will undergo brief maintenance soon.'),
  mk('maintenance_complete', 'Maintenance completed', '✅', 'success', 'Back online', 'Maintenance is complete — everything is running normally.'),
  mk('security_announcement', 'Security announcement', '🔒', 'alert', 'Security notice', 'An important security update from the MyTrade team.'),
  mk('platform_announcement', 'Platform announcement', '📢', 'info', 'Announcement', 'A message from the MyTrade team.'),
];
