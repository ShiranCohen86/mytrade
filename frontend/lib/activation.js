/**
 * Activation milestones — fire each event at most once per device and emit the
 * install signal once the user is clearly engaged ("aha"). Components call these
 * from the natural place in their flow; guards keep them idempotent.
 */
import { track, EV } from './analytics';

const FLAGS_KEY = 'mytrade-activation';

function readFlags() {
  try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}'); } catch { return {}; }
}
/** Set a milestone flag; returns true the first time only. */
function setFlag(key) {
  const f = readFlags();
  if (f[key]) return false;
  f[key] = Date.now();
  try { localStorage.setItem(FLAGS_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  return true;
}
export function hasFlag(key) {
  return !!readFlags()[key];
}

export function onOnboardingCompleted() {
  if (setFlag('onboarding')) track(EV.ONBOARDING_COMPLETED, {});
}

export function onStockViewed() {
  if (setFlag('firstView')) track(EV.FIRST_STOCK_VIEWED, {});
  track(EV.STOCK_VIEWED, {});
}

export function onFirstAlertSet() {
  if (setFlag('firstAlert')) track(EV.FIRST_ALERT_SET, {});
  track(EV.ALERT_SET, {});
}

/** Called after a watchlist add with the resulting total count. */
export function onStockAdded(total) {
  track(EV.WATCHLIST_ADD, { total });
  if (setFlag('firstStock')) track(EV.FIRST_STOCK_ADDED, {});
  onWatchlistCount(total);
}

export function onStockRemoved(total) {
  track(EV.WATCHLIST_REMOVE, { total });
}

/** Evaluate engagement thresholds against the current watchlist size. */
export function onWatchlistCount(total) {
  if (typeof total !== 'number') return;
  if (total >= 3 && setFlag('aha')) {
    track(EV.AHA_REACHED, { watchlist: total });
    // Let the install prompt know the user is engaged enough to ask.
    try { window.dispatchEvent(new Event('mytrade:install-signal')); } catch { /* ignore */ }
  }
  if (total >= 5 && hasFlag('firstAlert') && setFlag('power')) {
    track(EV.USER_BECAME_POWER_USER, { watchlist: total });
  }
}

export default {
  onOnboardingCompleted, onStockViewed, onFirstAlertSet,
  onStockAdded, onStockRemoved, onWatchlistCount, hasFlag,
};
