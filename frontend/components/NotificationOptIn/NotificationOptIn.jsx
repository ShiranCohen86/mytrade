import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { useToast } from '@/components/Toast/ToastProvider';
import { track, EV, getPlatform, isStandalone } from '@/lib/analytics';
import { tapMedium } from '@/lib/haptics';
import { isPushSupported, getPermission, subscribeToPush } from '@/lib/push';
import { claimSlot, releaseSlot, SLOT_FREE_EVENT } from '@/lib/pwaPromptSlot';
import styles from './NotificationOptIn.module.scss';

const SNOOZE_KEY = 'mytrade-notif-snooze';
const BACKOFF_DAYS = [3, 14, 60];

function readSnooze() {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); } catch { return {}; }
}
function snooze() {
  const s = readSnooze();
  const count = (s.count || 0) + 1;
  const days = BACKOFF_DAYS[Math.min(count - 1, BACKOFF_DAYS.length - 1)];
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ count, until: Date.now() + days * 86400_000 })); } catch { /* ignore */ }
}
function isSnoozed() {
  const s = readSnooze();
  return !!(s.until && Date.now() < s.until);
}

/**
 * Branded pre-permission modal. Appears immediately on launch (and again on a
 * high-intent action like setting a price alert) whenever notifications haven't
 * been decided yet. Tapping "Enable" fires the REAL native permission request
 * (gesture-safe) and subscribes to push. On iOS, push requires an installed
 * PWA, so we defer to the install prompt when not running standalone.
 */
export function NotificationOptIn() {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const maybeShow = useCallback(() => {
    if (open) return;
    if (!isPushSupported()) return;
    if (getPermission() !== 'default') return;          // already granted or blocked
    if (getPlatform() === 'ios' && !isStandalone()) return; // needs installed PWA first
    if (isSnoozed()) return;
    if (!claimSlot('notif')) return;                    // install/update is showing — wait
    setOpen(true);
  }, [open]);

  useEffect(() => {
    // Launch: try shortly after the install prompt has had first claim on the slot.
    const timer = setTimeout(maybeShow, 900);
    const onSignal = () => maybeShow();        // high intent: user just set an alert
    const onSlotFree = () => maybeShow();      // install/update closed → our turn
    window.addEventListener('mytrade:notif-signal', onSignal);
    window.addEventListener(SLOT_FREE_EVENT, onSlotFree);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mytrade:notif-signal', onSignal);
      window.removeEventListener(SLOT_FREE_EVENT, onSlotFree);
    };
  }, [maybeShow]);

  useEffect(() => {
    if (open) track(EV.SOFT_NOTIFICATION_PROMPT_SHOWN, {});
  }, [open]);

  // Reconcile on launch: if permission was already granted (possibly before the
  // server had VAPID keys), make sure a live subscription exists. No prompt is
  // shown — permission is already granted — so this is silent and gesture-free.
  useEffect(() => {
    if (getPermission() === 'granted') subscribeToPush().catch(() => {});
  }, []);

  const decline = useCallback(() => {
    track(EV.SOFT_NOTIFICATION_PROMPT_DECLINED, {});
    snooze();
    setOpen(false);
    releaseSlot('notif');
  }, []);

  const accept = useCallback(async () => {
    tapMedium();
    track(EV.SOFT_NOTIFICATION_PROMPT_ACCEPTED, {});
    // Call subscribeToPush BEFORE closing — its first await is the native
    // permission request, so the user gesture stays active (iOS requirement).
    let res;
    try {
      res = await subscribeToPush();
    } catch {
      // Never leave the sheet stuck open / the slot held if subscribe throws.
      res = { ok: false, reason: 'error' };
    }
    setOpen(false);
    releaseSlot('notif');
    if (res.ok) {
      toast.success(t('pwa.notifEnabledToast', "You're all set — we'll keep you posted."));
    } else if (res.reason === 'denied') {
      toast.warning(t('pwa.notifBlockedDesc', 'Notifications are blocked. Enable them for MyTrade in your settings.'));
    } else if (res.reason === 'error') {
      toast.error(t('pwa.notifFailedToast', "Couldn't enable notifications. Please try again."));
    }
    // 'server-disabled' / 'default' (dismissed native prompt): stay silent.
  }, [t, toast]);

  if (!open) return null;

  return (
    <BottomSheet title={t('pwa.enableNotifsTitle', 'Stay in the loop')} onClose={decline}>
      <div className={styles.content}>
        <span className={styles.bell} aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <h3 className={styles.title}>{t('pwa.enableNotifsTitle', 'Stay in the loop')}</h3>
        <p className={styles.desc}>{t('pwa.enableNotifsDesc', 'Get notified when your price alerts trigger and when big moves hit your watchlist.')}</p>
        <ul className={styles.benefits}>
          <li>{t('pwa.notifBenefit1', 'Price alerts the moment they hit')}</li>
          <li>{t('pwa.notifBenefit2', 'Earnings reminders before they report')}</li>
          <li>{t('pwa.notifBenefit3', 'A daily summary of your watchlist')}</li>
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={accept}>
            {t('pwa.enableNotifs', 'Enable notifications')}
          </button>
          <button type="button" className={styles.secondary} onClick={decline}>
            {t('pwa.maybeLater', 'Maybe later')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default NotificationOptIn;
