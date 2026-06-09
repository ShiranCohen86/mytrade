import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { track, EV, getSessionCount } from '@/lib/analytics';
import { tapMedium } from '@/lib/haptics';
import { hasFlag } from '@/lib/activation';
import {
  getDeferredPrompt, clearDeferredPrompt, isStandalone, isIOS, isIPad,
  isSnoozed, isExhausted, snooze,
} from '@/lib/pwaInstall';
import styles from './InstallPrompt.module.scss';

function isIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent || '';
  // Other iOS browsers (Chrome/Firefox/Edge) can't add to home screen.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Engaged enough to ask: 2+ sessions or already hit the "aha" milestone. */
function isEngaged() {
  return getSessionCount() >= 2 || hasFlag('aha');
}

/**
 * Custom, platform-aware install prompt. Mounted inside the authenticated app
 * shell. Shows a native install sheet on Android/desktop (via beforeinstallprompt)
 * and an illustrated "Add to Home Screen" guide on iOS Safari. Smart-timed,
 * snoozable with backoff, and fully tracked.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [mode, setMode] = useState(null); // null | 'native' | 'ios'
  const shownRef = useRef(false);

  const evaluate = useCallback(() => {
    if (shownRef.current || mode) return;
    if (isStandalone() || isSnoozed() || isExhausted() || !isEngaged()) return;
    if (getDeferredPrompt()) { setMode('native'); return; }
    if (isIOSSafari()) setMode('ios');
  }, [mode]);

  useEffect(() => {
    // Small delay so we never interrupt the first paint / a fresh navigation.
    const timer = setTimeout(evaluate, 2500);
    const onAvail = () => evaluate();
    const onSignal = () => evaluate();
    window.addEventListener('mytrade:installavailable', onAvail);
    window.addEventListener('mytrade:install-signal', onSignal);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mytrade:installavailable', onAvail);
      window.removeEventListener('mytrade:install-signal', onSignal);
    };
  }, [evaluate]);

  useEffect(() => {
    if (mode && !shownRef.current) {
      shownRef.current = true;
      track(EV.INSTALL_PROMPT_SHOWN, { platform: mode === 'ios' ? 'ios' : undefined, surface: mode });
    }
  }, [mode]);

  const close = useCallback(() => setMode(null), []);

  const dismiss = useCallback(() => {
    snooze();
    track(EV.INSTALL_PROMPT_DISMISSED, { surface: mode });
    close();
  }, [mode, close]);

  const acceptNative = useCallback(async () => {
    tapMedium();
    const dp = getDeferredPrompt();
    if (!dp) { close(); return; }
    try {
      dp.prompt();
      const choice = await dp.userChoice;
      if (choice && choice.outcome === 'accepted') {
        track(EV.INSTALL_PROMPT_ACCEPTED, {});
      } else {
        track(EV.INSTALL_PROMPT_DISMISSED, { surface: 'native', viaChoice: true });
        snooze();
      }
    } catch {
      /* prompt already used / not allowed */
    } finally {
      clearDeferredPrompt();
      close();
    }
  }, [close]);

  if (!mode) return null;

  if (mode === 'native') {
    return (
      <BottomSheet title={t('pwa.installTitle', 'Install MyTrade')} onClose={dismiss}>
        <div className={styles.content}>
          <img className={styles.appIcon} src="/pwa-192x192.png" alt="" width="64" height="64" />
          <p className={styles.desc}>{t('pwa.installDesc', 'Add MyTrade to your home screen for a faster, full-screen, app-like experience.')}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={acceptNative}>
              {t('pwa.install', 'Install')}
            </button>
            <button type="button" className={styles.secondary} onClick={dismiss}>
              {t('pwa.notNow', 'Not now')}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  // iOS Safari — manual Add to Home Screen guide.
  const intro = isIPad() ? t('pwa.iosInstallIntroPad', 'Install this app on your iPad:') : t('pwa.iosInstallIntro', 'Install this app on your iPhone:');
  return (
    <BottomSheet title={t('pwa.iosInstallTitle', 'Install MyTrade')} onClose={dismiss}>
      <div className={styles.content}>
        <img className={styles.appIcon} src="/pwa-192x192.png" alt="" width="64" height="64" />
        <p className={styles.desc}>{intro}</p>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M8 8l4-4 4 4" />
                <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
            </span>
            <span>{t('pwa.iosInstallStep1', 'Tap the Share button')}</span>
          </li>
          <li>
            <span className={styles.stepIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" />
              </svg>
            </span>
            <span>{t('pwa.iosInstallStep2', 'Choose "Add to Home Screen"')}</span>
          </li>
          <li>
            <span className={styles.stepIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span>{t('pwa.iosInstallStep3', 'Tap "Add" to finish')}</span>
          </li>
        </ol>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={dismiss}>
            {t('common.close', 'Got it')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default InstallPrompt;
