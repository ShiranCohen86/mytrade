import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { track, EV } from '@/lib/analytics';
import { tapMedium } from '@/lib/haptics';
import { claimSlot, releaseSlot, SLOT_FREE_EVENT } from '@/lib/pwaPromptSlot';
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

/**
 * Custom, platform-aware install prompt. Appears immediately when the app is
 * installable (Android/desktop via beforeinstallprompt; iOS Safari via an
 * illustrated Add-to-Home-Screen guide). Snoozable with backoff, fully tracked,
 * and coordinated so it never stacks with the notification prompt.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [mode, setMode] = useState(null); // null | 'native' | 'ios'
  const shownRef = useRef(false);

  const evaluate = useCallback(() => {
    if (shownRef.current || mode) return;
    if (isStandalone() || isSnoozed() || isExhausted()) return;
    let next = null;
    if (getDeferredPrompt()) next = 'native';
    else if (isIOSSafari()) next = 'ios';
    if (!next) return;
    if (!claimSlot('install')) return; // a higher-priority dialog is showing
    setMode(next);
  }, [mode]);

  useEffect(() => {
    // Check right away (the install event may have already fired), again just
    // after first paint, and whenever the event fires later.
    evaluate();
    const timer = setTimeout(evaluate, 600);
    const onAvail = () => evaluate();
    const onSlotFree = () => evaluate(); // notification prompt closed → our turn
    window.addEventListener('mytrade:installavailable', onAvail);
    window.addEventListener(SLOT_FREE_EVENT, onSlotFree);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mytrade:installavailable', onAvail);
      window.removeEventListener(SLOT_FREE_EVENT, onSlotFree);
    };
  }, [evaluate]);

  useEffect(() => {
    if (mode && !shownRef.current) {
      shownRef.current = true;
      track(EV.INSTALL_PROMPT_SHOWN, { platform: mode === 'ios' ? 'ios' : undefined, surface: mode });
    }
  }, [mode]);

  const close = useCallback(() => { setMode(null); releaseSlot('install'); }, []);

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
