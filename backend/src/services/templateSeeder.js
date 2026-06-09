/**
 * Idempotently seeds the 8 built-in notification templates on boot. System
 * templates are matched by `key`; existing ones are left untouched so admin
 * edits are never overwritten.
 */
const NotificationTemplate = require('../models/NotificationTemplate');
const logger = require('../utils/logger');

const DEFAULTS = [
  {
    key: 'welcome', name: 'Welcome', type: 'success', icon: '👋',
    title: 'Welcome to MyTrade', message: 'Your intelligent stock dashboard is ready. Add your first ticker to get started.',
    deepLink: '/dashboard', actionText: 'Open dashboard',
    defaultChannels: { push: false, inApp: true },
  },
  {
    key: 'feature_update', name: 'Feature Update', type: 'info', icon: '✨',
    title: 'New feature available', message: 'We just shipped something new — check it out.',
    deepLink: '/dashboard', actionText: 'See what’s new',
    defaultChannels: { push: true, inApp: true },
  },
  {
    key: 'market_alert', name: 'Market Alert', type: 'warning', icon: '📈',
    title: 'Market moving', message: 'Significant movement detected in markets you follow.',
    deepLink: '/dashboard', actionText: 'View',
    defaultChannels: { push: true, inApp: true },
  },
  {
    key: 'system_alert', name: 'System Alert', type: 'alert', icon: '⚠️',
    title: 'System notice', message: 'An important system notice from the MyTrade team.',
    deepLink: '', actionText: '',
    defaultChannels: { push: true, inApp: true },
  },
  {
    key: 'breaking_news', name: 'Breaking News', type: 'alert', icon: '🚨',
    title: 'Breaking', message: 'Breaking market news you should know about.',
    deepLink: '/dashboard', actionText: 'Read',
    defaultChannels: { push: true, inApp: true },
  },
  {
    key: 'maintenance', name: 'Maintenance', type: 'warning', icon: '🛠️',
    title: 'Scheduled maintenance', message: 'MyTrade will undergo brief maintenance. Service may be intermittent.',
    deepLink: '', actionText: '',
    defaultChannels: { push: false, inApp: true },
  },
  {
    key: 'engagement_reminder', name: 'Engagement Reminder', type: 'info', icon: '🔔',
    title: 'Don’t miss out', message: 'Your watchlist has updates waiting for you.',
    deepLink: '/dashboard', actionText: 'Check now',
    defaultChannels: { push: true, inApp: true },
  },
  {
    key: 'reactivation', name: 'Re-activation', type: 'info', icon: '💜',
    title: 'We miss you', message: 'A lot has changed since your last visit. Come see what’s new.',
    deepLink: '/dashboard', actionText: 'Return to MyTrade',
    defaultChannels: { push: true, inApp: true },
  },
];

async function seedTemplates() {
  try {
    let created = 0;
    for (const def of DEFAULTS) {
      // eslint-disable-next-line no-await-in-loop
      const res = await NotificationTemplate.updateOne(
        { key: def.key, isSystem: true },
        { $setOnInsert: { ...def, isSystem: true, status: 'active' } },
        { upsert: true }
      );
      if (res.upsertedCount) created += 1;
    }
    if (created) logger.info(`[notif] seeded ${created} default template(s)`);
  } catch (err) {
    logger.warn('[notif] template seed failed', { err: err.message });
  }
}

module.exports = { seedTemplates };
