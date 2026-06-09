/* global __APP_VERSION__, __APP_BUILD__ */
/**
 * Lightweight, fire-and-forget product analytics.
 * Batches events and ships them to the backend (`POST /api/events`) via
 * sendBeacon / keepalive fetch. Never throws, never blocks, never redirects.
 *
 * Sink: own backend (Mongo) — surfaced in the admin analytics dashboard.
 */
const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';
const TOKEN_KEY = 'mytrade-token';
const DEVICE_KEY = 'mytrade-device-id';
const LASTSEEN_KEY = 'mytrade-last-seen';
const SESSIONS_KEY = 'mytrade-session-count';
const ACTIVE_FLAG = 'mytrade-became-active';
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

// Canonical event names (import these instead of stringly-typing).
export const EV = {
  // Lifecycle
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  USER_RETURNED: 'USER_RETURNED',
  USER_BECAME_ACTIVE: 'USER_BECAME_ACTIVE',
  USER_BECAME_POWER_USER: 'USER_BECAME_POWER_USER',
  PWA_LAUNCHED_STANDALONE: 'PWA_LAUNCHED_STANDALONE',
  // PWA health
  SW_INSTALLED: 'SW_INSTALLED',
  SW_UPDATED: 'SW_UPDATED',
  UPDATE_PROMPT_SHOWN: 'UPDATE_PROMPT_SHOWN',
  UPDATE_PROMPT_ACCEPTED: 'UPDATE_PROMPT_ACCEPTED',
  OFFLINE_VIEW: 'OFFLINE_VIEW',
  RECONNECTED: 'RECONNECTED',
  // Install (Phase B)
  INSTALL_PROMPT_SHOWN: 'INSTALL_PROMPT_SHOWN',
  INSTALL_PROMPT_ACCEPTED: 'INSTALL_PROMPT_ACCEPTED',
  INSTALL_PROMPT_DISMISSED: 'INSTALL_PROMPT_DISMISSED',
  PWA_INSTALLED: 'PWA_INSTALLED',
  // Activation (Phase B)
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
  FIRST_STOCK_ADDED: 'FIRST_STOCK_ADDED',
  FIRST_ALERT_SET: 'FIRST_ALERT_SET',
  FIRST_STOCK_VIEWED: 'FIRST_STOCK_VIEWED',
  AHA_REACHED: 'AHA_REACHED',
  // Notifications (Phase C)
  SOFT_NOTIFICATION_PROMPT_SHOWN: 'SOFT_NOTIFICATION_PROMPT_SHOWN',
  SOFT_NOTIFICATION_PROMPT_ACCEPTED: 'SOFT_NOTIFICATION_PROMPT_ACCEPTED',
  SOFT_NOTIFICATION_PROMPT_DECLINED: 'SOFT_NOTIFICATION_PROMPT_DECLINED',
  NOTIFICATION_PERMISSION_GRANTED: 'NOTIFICATION_PERMISSION_GRANTED',
  NOTIFICATION_PERMISSION_DENIED: 'NOTIFICATION_PERMISSION_DENIED',
  PUSH_SUBSCRIBED: 'PUSH_SUBSCRIBED',
  NOTIFICATION_SETTINGS_CHANGED: 'NOTIFICATION_SETTINGS_CHANGED',
  // Engagement
  WATCHLIST_ADD: 'WATCHLIST_ADD',
  WATCHLIST_REMOVE: 'WATCHLIST_REMOVE',
  STOCK_VIEWED: 'STOCK_VIEWED',
  SEARCH_PERFORMED: 'SEARCH_PERFORMED',
  ALERT_SET: 'ALERT_SET',
  COMMAND_PALETTE_OPENED: 'COMMAND_PALETTE_OPENED',
  SHARE_CLICKED: 'SHARE_CLICKED',
  INVITE_SHARED: 'INVITE_SHARED',
  SHARE_TARGET_RECEIVED: 'SHARE_TARGET_RECEIVED',
};

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function ls(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

function getDeviceId() {
  let id = ls(DEVICE_KEY);
  if (!id) { id = uuid(); lsSet(DEVICE_KEY, id); }
  return id;
}

export function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true
    );
  } catch { return false; }
}

export function getPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const sessionId = uuid();
const deviceId = getDeviceId();
let userId = null;
let queue = [];
let flushTimer = null;
const FLUSH_MS = 8000;
const MAX_BATCH = 20;

/** Attach the authenticated user id once known (call from AuthContext). */
export function identifyUser(id) {
  userId = id || null;
}

/** Number of app sessions this device has started (>= 1 after init). */
export function getSessionCount() {
  return Number(ls(SESSIONS_KEY) || 0);
}

function baseContext() {
  return {
    sessionId,
    deviceId,
    userId,
    platform: getPlatform(),
    standalone: isStandalone(),
    appVersion: APP_VERSION,
    appBuild: APP_BUILD,
    lang: (typeof document !== 'undefined' && document.documentElement.lang) || 'en',
    ts: Date.now(),
  };
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_MS);
}

export function flush(useBeacon = false) {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const url = `${EXPRESS}/api/events`;
  const payload = JSON.stringify({ events: batch });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      return;
    }
  } catch { /* fall through to fetch */ }
  const token = ls(TOKEN_KEY);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload,
    credentials: 'include',
    keepalive: true,
  }).catch(() => { /* best-effort; drop on failure */ });
}

/** Record an event. `name` should come from EV. */
export function track(name, props = {}) {
  if (!name) return;
  queue.push({ event: name, props, ...baseContext() });
  if (queue.length >= MAX_BATCH) flush();
  else scheduleFlush();
}

let started = false;
/** Initialize lifecycle tracking. Safe to call once on app boot. */
export function initAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') || undefined;
  const ref = params.get('ref') || undefined;

  // Count sessions; promote to "active" at the 3rd session (once).
  const sessions = getSessionCount() + 1;
  lsSet(SESSIONS_KEY, String(sessions));
  track(EV.SESSION_START, { source, ref, sessionNumber: sessions, referrer: document.referrer || undefined });
  if (sessions >= 3 && !ls(ACTIVE_FLAG)) {
    lsSet(ACTIVE_FLAG, '1');
    track(EV.USER_BECAME_ACTIVE, { sessions });
  }

  if (isStandalone()) track(EV.PWA_LAUNCHED_STANDALONE, { source });

  // Returning-user detection (gap since last visit).
  const last = Number(ls(LASTSEEN_KEY) || 0);
  const now = Date.now();
  if (last) {
    const hoursAway = (now - last) / 36e5;
    if (hoursAway >= 6) {
      track(EV.USER_RETURNED, { hoursAway: Math.round(hoursAway), daysAway: Math.round(hoursAway / 24) });
    }
  }
  lsSet(LASTSEEN_KEY, String(now));
  const heartbeat = setInterval(() => lsSet(LASTSEEN_KEY, String(Date.now())), 60000);

  // Flush on hide / unload using a beacon so events aren't lost.
  const onHide = () => {
    lsSet(LASTSEEN_KEY, String(Date.now()));
    track(EV.SESSION_END, {});
    flush(true);
  };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });

  // Connectivity signals.
  window.addEventListener('offline', () => track(EV.OFFLINE_VIEW, {}));
  window.addEventListener('online', () => track(EV.RECONNECTED, {}));

  // Clean shutdown if HMR disposes the module in dev.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => { clearInterval(heartbeat); window.removeEventListener('pagehide', onHide); });
  }
}

export default { track, flush, initAnalytics, identifyUser, isStandalone, getPlatform, EV };
