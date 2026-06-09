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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Request permission (if needed) and register a push subscription with the backend.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function subscribeToPush(categories) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  const reg = await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
    track(permission === 'granted' ? EV.NOTIFICATION_PERMISSION_GRANTED : EV.NOTIFICATION_PERMISSION_DENIED, {});
  }
  if (permission !== 'granted') return { ok: false, reason: permission };

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
