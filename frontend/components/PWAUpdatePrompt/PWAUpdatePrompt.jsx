import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { track, EV } from '@/lib/analytics';
import styles from './PWAUpdatePrompt.module.scss';

/**
 * Shows an interactive "new version available" prompt whenever a new deploy
 * ships a new service worker. Registering with `registerType: 'prompt'` means
 * the fresh SW waits until the user accepts — clicking Update activates it and
 * reloads into the new build. Also surfaces a brief "ready offline" confirmation.
 */
export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const regRef = useRef(null);
  const pollRef = useRef(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      track(EV.SW_INSTALLED, {});
      regRef.current = registration || null;
      // Long-lived sessions: poll for a new deploy hourly (cleared on unmount).
      if (registration) {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(() => { registration.update().catch(() => {}); }, 60 * 60 * 1000);
      }
    },
    onRegisterError() { /* best-effort; ignore */ },
  });

  useEffect(() => () => clearInterval(pollRef.current), []);

  // Check for a fresh deploy whenever the user returns to the app, so the
  // update prompt appears promptly instead of waiting for the hourly poll.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') regRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    if (needRefresh) track(EV.UPDATE_PROMPT_SHOWN, {});
  }, [needRefresh]);

  useEffect(() => {
    if (!offlineReady) return undefined;
    const id = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  if (needRefresh) {
    return (
      <div className={styles.wrap} role="alertdialog" aria-live="assertive" aria-label={t('pwa.updateTitle', 'New version available')}>
        <div className={styles.card}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </span>
          <div className={styles.body}>
            <div className={styles.title}>{t('pwa.updateTitle', 'New version available')}</div>
            <div className={styles.desc}>{t('pwa.updateDesc', 'A new version of MyTrade is ready to install.')}</div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.update}
              onClick={() => { track(EV.UPDATE_PROMPT_ACCEPTED, {}); updateServiceWorker(true); }}
            >
              {t('pwa.updateNow', 'Update')}
            </button>
            <button type="button" className={styles.later} onClick={() => setNeedRefresh(false)}>
              {t('pwa.later', 'Later')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${styles.info}`}>
        <span className={styles.icon} aria-hidden="true">✓</span>
        <div className={styles.body}>
          <div className={styles.title}>{t('pwa.offlineReady', 'Ready to work offline')}</div>
        </div>
      </div>
    </div>
  );
}

export default PWAUpdatePrompt;
