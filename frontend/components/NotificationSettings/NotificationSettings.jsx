import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import { getPushStatus, updatePushPreferences } from '@/lib/apiClient';
import { isPushSupported, getPermission, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { track, EV, getPlatform, isStandalone } from '@/lib/analytics';
import styles from './NotificationSettings.module.scss';

const CATEGORIES = [
  ['price_alert', 'Price alerts', 'When a stock crosses your target price'],
  ['big_mover', 'Big movers', 'Large moves in your watchlist'],
  ['earnings', 'Earnings reminders', 'Before a watchlist stock reports'],
  ['digest', 'Daily market digest', 'A morning summary of your watchlist'],
  ['product', 'Product news', 'Occasional updates about MyTrade'],
];

export function NotificationSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const permission = getPermission();
  const iosNeedsInstall = getPlatform() === 'ios' && !isStandalone();

  const load = useCallback(() => {
    getPushStatus().then(setStatus).catch(() => setStatus({ enabled: false, subscribed: false, categories: [], allCategories: [] }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const res = await subscribeToPush(CATEGORIES.map((c) => c[0]));
      if (res.ok) { toast.success(t('settings.notifEnabled', 'Notifications enabled')); load(); }
      else if (res.reason === 'denied') toast.warning(t('pwa.notifBlockedDesc', 'Enable notifications for MyTrade in your settings to receive alerts.'));
      else if (res.reason === 'server-disabled') toast.error(t('settings.notifUnavailable', 'Notifications are not available right now.'));
    } finally { setBusy(false); }
  }, [t, toast, load]);

  const disable = useCallback(async () => {
    setBusy(true);
    try { await unsubscribeFromPush(); toast.success(t('settings.notifDisabled', 'Notifications turned off')); load(); }
    finally { setBusy(false); }
  }, [t, toast, load]);

  const toggleCategory = useCallback(async (cat) => {
    if (!status?.subscribed) return;
    const current = new Set(status.categories || []);
    if (current.has(cat)) current.delete(cat); else current.add(cat);
    const next = Array.from(current);
    setStatus((s) => ({ ...s, categories: next })); // optimistic
    try {
      await updatePushPreferences(next);
      track(EV.NOTIFICATION_SETTINGS_CHANGED, { categories: next });
    } catch {
      load(); // revert from server on failure
    }
  }, [status, load]);

  if (!isPushSupported()) {
    return <p className={styles.note}>{t('settings.notifUnsupported', 'Your browser does not support notifications.')}</p>;
  }
  if (status && status.enabled === false) {
    return <p className={styles.note}>{t('settings.notifUnavailable', 'Notifications are not available right now.')}</p>;
  }

  const subscribed = !!status?.subscribed;
  const enabledCats = new Set(status?.categories || []);

  return (
    <div className={styles.wrap}>
      <div className={styles.masterRow}>
        <div className={styles.masterLabel}>
          <span className={styles.masterName}>{t('settings.pushNotifications', 'Push notifications')}</span>
          <span className={styles.masterDesc}>
            {subscribed
              ? t('settings.notifOnDesc', 'This device will receive alerts and reminders.')
              : t('settings.notifOffDesc', 'Get notified when your alerts trigger.')}
          </span>
        </div>
        <button
          type="button"
          className={subscribed ? styles.btnGhost : styles.btnPrimary}
          onClick={subscribed ? disable : enable}
          disabled={busy || (!subscribed && (permission === 'denied' || iosNeedsInstall))}
        >
          {busy ? '…' : subscribed ? t('settings.turnOff', 'Turn off') : t('settings.turnOn', 'Turn on')}
        </button>
      </div>

      {!subscribed && permission === 'denied' && (
        <p className={styles.warn}>{t('pwa.notifBlockedDesc', 'Notifications are blocked. Enable them for MyTrade in your browser or system settings.')}</p>
      )}
      {!subscribed && iosNeedsInstall && (
        <p className={styles.warn}>{t('settings.notifIosInstall', 'Install MyTrade to your home screen to enable notifications on iOS.')}</p>
      )}

      {subscribed && (
        <ul className={styles.catList}>
          {CATEGORIES.map(([cat, label, desc]) => (
            <li key={cat} className={styles.catRow}>
              <div className={styles.catLabel}>
                <span className={styles.catName}>{t(`settings.cat.${cat}`, label)}</span>
                <span className={styles.catDesc}>{t(`settings.catDesc.${cat}`, desc)}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabledCats.has(cat)}
                className={`${styles.switch} ${enabledCats.has(cat) ? styles.switchOn : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                <span className={styles.knob} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NotificationSettings;
