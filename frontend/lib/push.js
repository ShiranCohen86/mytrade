/**
 * Client-side Web Push helpers: permission, subscribe/unsubscribe against the
 * service worker's PushManager, and app-badge clearing. All best-effort.
 */
import { track, EV, getPlatform } from './analytics';
import { getPushVapidKey, savePushSubscription, removePushSubscription } from './apiClient';

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermission() {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

/**
 * Request the native notification permission. MUST be called synchronously from
 * a user gesture (do not await anything before calling this) — otherwise iOS
 * Safari / WebKit drop the user-activation and the prompt silently no-ops.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  let result;
  try {
    // Some old WebKit builds only support the callback form.
    result = await new Promise((resolve) => {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve);
    });
  } catch {
    result = Notification.permission;
  }
  track(result === 'granted' ? EV.NOTIFICATION_PERMISSION_GRANTED : EV.NOTIFICATION_PERMISSION_DENIED, {});
  return result;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Full opt-in: request the native permission (gesture-safe — this is the first
 * awaited call), then register a push subscription with the backend.
 * Call this DIRECTLY from a click handler.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function subscribeToPush(categories) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  // 1) Permission FIRST — nothing is awaited before this, so the user gesture
  //    is still active (required by iOS Safari / WebKit).
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return { ok: false, reason: permission };

  // 2) Now the async plumbing: wait for the SW, fetch the key, subscribe.
  const reg = await navigator.serviceWorker.ready;
  const { key, enabled } = await getPushVapidKey();
  if (!enabled || !key) return { ok: false, reason: 'server-disabled' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await savePushSubscription(sub.toJSON(), getPlatform(), categories);
  track(EV.PUSH_SUBSCRIBED, {});
  return { ok: true };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  try { await sub.unsubscribe(); } catch { /* ignore */ }
  try { await removePushSubscription(endpoint); } catch { /* ignore */ }
}

/** True when this device already has an active push subscription. */
export async function hasLocalSubscription() {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export function clearAppBadge() {
  try {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch { /* ignore */ }
}
