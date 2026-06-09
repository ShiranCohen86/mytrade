/* User-behavior triggers. evaluatorClass='user' (or 'event'). ctx = {user, hasNotif, isPwa, hasWatchlist, daysInactive, returned}. */
const ageDays = (c) => (c.user && c.user.createdAt ? (Date.now() - new Date(c.user.createdAt)) / 86400000 : 0);
const mk = (key, label, description, paramSchema, match, defaults, dedupeKey, evaluatorClass = 'user') => ({
  key, category: 'user', evaluatorClass, feasible: true, label, description, paramSchema, match, defaults, dedupeKey,
});
const daily = (key) => () => `${key}:${new Date().toISOString().slice(0, 10)}`;

module.exports = [
  mk('user_registered', 'New registration / welcome', 'Fires once when a user signs up',
    [], () => true,
    () => ({ title: 'Welcome to MyTrade 👋', message: 'Hi {{firstName}}! Add your first ticker to start tracking the market.', type: 'success', icon: '👋', deepLink: '/dashboard', actionText: 'Get started' }),
    (c) => `welcome:${c.user && c.user._id}`, 'event'),

  mk('user_inactive', 'User inactive N days', 'No activity for N+ days',
    [{ name: 'days', type: 'number', default: 7, label: 'Inactive for (days)' }],
    (c, p) => c.daysInactive != null && c.daysInactive >= Number(p.days || 7),
    () => ({ title: 'We miss you 💜', message: 'A lot has moved since your last visit — come take a look.', type: 'info', icon: '💜', deepLink: '/dashboard', actionText: 'Return' }),
    (c, p) => `inactive:${p.days}:${new Date().toISOString().slice(0, 10)}`),

  mk('user_returned', 'User returned after inactivity', 'Came back after a gap',
    [], (c) => c.returned === true,
    () => ({ title: 'Welcome back!', message: 'Good to see you again, {{firstName}} — here’s what changed while you were away.', type: 'success', icon: '🎉', deepLink: '/dashboard', actionText: 'Catch up' }),
    (c) => `returned:${c.user && c.user._id}:${new Date().toISOString().slice(0, 10)}`),

  mk('no_watchlist', 'No watchlist created', 'Empty watchlist after signup',
    [{ name: 'afterDays', type: 'number', default: 1, label: 'After (days)' }],
    (c, p) => !c.hasWatchlist && ageDays(c) >= Number(p.afterDays || 1),
    () => ({ title: 'Build your watchlist', message: 'Add a stock to get scores, alerts and insights.', type: 'info', icon: '⭐', deepLink: '/dashboard', actionText: 'Add a stock' }),
    daily('no_watchlist')),

  mk('no_followed_stocks', 'Not following stocks', 'Currently following no stocks',
    [{ name: 'afterDays', type: 'number', default: 2, label: 'After (days)' }],
    (c, p) => !c.hasWatchlist && ageDays(c) >= Number(p.afterDays || 2),
    () => ({ title: 'Follow your first stock', message: 'Track a ticker to unlock personalized alerts.', type: 'info', icon: '📈', deepLink: '/dashboard', actionText: 'Browse' }),
    daily('no_followed')),

  mk('onboarding_incomplete', 'Onboarding incomplete', 'Did not finish onboarding',
    [{ name: 'afterHours', type: 'number', default: 24, label: 'After (hours)' }],
    (c, p) => c.user && !c.user.onboardingDone && ageDays(c) * 24 >= Number(p.afterHours || 24),
    () => ({ title: 'Finish setting up', message: 'You’re one step away from your personalized dashboard.', type: 'info', icon: '✅', deepLink: '/dashboard', actionText: 'Continue' }),
    daily('onboarding')),

  mk('notifications_disabled', 'Notifications not enabled', 'No push subscription',
    [{ name: 'afterDays', type: 'number', default: 1, label: 'After (days)' }],
    (c, p) => !c.hasNotif && ageDays(c) >= Number(p.afterDays || 1),
    () => ({ title: 'Never miss a move', message: 'Enable notifications to get price & market alerts.', type: 'info', icon: '🔔', deepLink: '/settings', actionText: 'Enable' }),
    daily('notif_off')),

  mk('pwa_not_installed', 'PWA not installed', 'Has not installed the app',
    [{ name: 'afterDays', type: 'number', default: 2, label: 'After (days)' }],
    (c, p) => !c.isPwa && ageDays(c) >= Number(p.afterDays || 2),
    () => ({ title: 'Install MyTrade', message: 'Add MyTrade to your home screen for instant access.', type: 'info', icon: '📲', deepLink: '/dashboard', actionText: 'How to install' }),
    daily('pwa_off')),
];
