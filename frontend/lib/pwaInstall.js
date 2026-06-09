/**
 * Install-prompt plumbing. Imported early (main.jsx) so the `beforeinstallprompt`
 * event is captured even if it fires before React mounts. Exposes the deferred
 * prompt, an availability signal, and snooze/backoff bookkeeping.
 */
import { track, EV, isStandalone, getPlatform } from './analytics';

const SNOOZE_KEY = 'mytrade-install-snooze';
// Backoff schedule (days) by number of prior dismissals; capped after the last.
const BACKOFF_DAYS = [1, 7, 30];

let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event('mytrade:installavailable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try { localStorage.removeItem(SNOOZE_KEY); } catch { /* ignore */ }
    track(EV.PWA_INSTALLED, { platform: getPlatform() });
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function clearDeferredPrompt() {
  deferredPrompt = null;
}

export { isStandalone, getPlatform };

export function isIOS() {
  return getPlatform() === 'ios';
}

/** True if iPad (copy differs slightly from iPhone). */
export function isIPad() {
  const ua = navigator.userAgent || '';
  return /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function readSnooze() {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); } catch { return {}; }
}

/** Currently within a snooze window? */
export function isSnoozed() {
  const s = readSnooze();
  return !!(s.until && Date.now() < s.until);
}

/** Already dismissed enough times that we stop nagging entirely. */
export function isExhausted() {
  const s = readSnooze();
  return (s.count || 0) >= BACKOFF_DAYS.length;
}

/** Record a dismissal and schedule the next eligible time with backoff. */
export function snooze() {
  const s = readSnooze();
  const count = (s.count || 0) + 1;
  const days = BACKOFF_DAYS[Math.min(count - 1, BACKOFF_DAYS.length - 1)];
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ count, until: Date.now() + days * 86400_000 }));
  } catch { /* ignore */ }
}

export default { getDeferredPrompt, clearDeferredPrompt, isStandalone, isIOS, isIPad, isSnoozed, isExhausted, snooze };
