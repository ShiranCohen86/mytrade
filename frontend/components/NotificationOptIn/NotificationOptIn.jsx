import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { useToast } from '@/components/Toast/ToastProvider';
import { track, EV, getPlatform, isStandalone } from '@/lib/analytics';
import { isPushSupported, getPermission, subscribeToPush } from '@/lib/push';
import styles from './NotificationOptIn.module.scss';

const SNOOZE_KEY = 'mytrade-notif-snooze';
const BACKOFF_DAYS = [7, 30, 90];

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
 * Value-first "soft ask" for notifications. Triggered by a high-intent action
 * (the user just set a price alert). Only fires the native permission prompt
 * after the user opts in here — the single biggest lever on opt-in rate.
 * On iOS, push requires an installed PWA, so we skip when not standalone and
 * let the install prompt lead instead.
 */
export function NotificationOptIn() {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  const maybeShow = useCallback(() => {
    if (open || shownRef.current) return;
    if (!isPushSupported()) return;
    if (getPermission() !== 'default') return; // already granted or blocked
    if (getPlatform() === 'ios' && !isStandalone()) return; // install first on iOS
    if (isSnoozed()) return;
    setOpen(true);
  }, [open]);

  useEffect(() => {
    const onSignal = () => maybeShow();
    window.addEventListener('mytrade:notif-signal', onSignal);
    return () => window.removeEventListener('mytrade:notif-signal', onSignal);
  }, [maybeShow]);

  useEffect(() => {
    if (open && !shownRef.current) {
      shownRef.current = true;
      track(EV.SOFT_NOTIFICATION_PROMPT_SHOWN, {});
    }
  }, [open]);

  const decline = useCallback(() => {
    track(EV.SOFT_NOTIFICATION_PROMPT_DECLINED, {});
    snooze();
    setOpen(false);
  }, []);

  const accept = useCallback(async () => {
    track(EV.SOFT_NOTIFICATION_PROMPT_ACCEPTED, {});
    setOpen(false);
    const res = await subscribeToPush();
    if (res.ok) {
      toast.success(t('pwa.enableNotifs', 'Enable notifications'));
    } else if (res.reason === 'denied') {
      toast.warning(t('pwa.notifBlockedDesc', 'Enable notifications for MyTrade in your settings to receive alerts.'));
    } else if (res.reason === 'server-disabled') {
      // Push not configured on the server — stay silent.
    }
  }, [t, toast]);

  if (!open) return null;

  return (
    <BottomSheet title={t('pwa.enableNotifsTitle', 'Stay in the loop')} onClose={decline}>
      <div className={styles.content}>
        <span className={styles.bell} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <p className={styles.desc}>{t('pwa.enableNotifsDesc', 'Get notified when your price alerts trigger and when big moves hit your watchlist.')}</p>
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
