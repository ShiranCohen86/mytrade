/* MyTrade service worker (Workbox, injectManifest strategy).
 * Handles: app-shell precache, runtime caching, offline fallback,
 * controlled update (SKIP_WAITING), and Web Push (Phase C). */
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

self.skipWaiting && self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();

// Precache the build output (injected at build time).
precacheAndRoute(self.__WB_MANIFEST || []);

// --- App shell: serve cached index.html for SPA navigations -------------
const navigationHandler = createHandlerBoundToURL('index.html');
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//, /^\/auth\//, /^\/admin\//, /^\/health/],
  }),
);

// --- API GET reads: network-first with short-lived fallback cache -------
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 }),
    ],
  }),
);

// --- Google Fonts -------------------------------------------------------
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// --- Images -------------------------------------------------------------
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// --- Offline fallback for anything that slips through -------------------
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return (await caches.match('/offline.html')) || Response.error();
  }
  return Response.error();
});

// =======================================================================
// Web Push (Phase C) — display + click-through
// =======================================================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'MyTrade', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'MyTrade';
  const options = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || '/dashboard', ...(data.data || {}) },
  };
  const tasks = [self.registration.showNotification(title, options)];
  // Best-effort app-icon badge (cleared when the app is next focused).
  if (self.navigator && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge().catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of wins) {
        if ('focus' in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            /* cross-origin or not allowed — ignore */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })(),
  );
});
