/* service-worker.js — PWA + Web Push */
const CACHE = 'ttd-v1';
const ASSETS = [
  '/', '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>null)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached || Response.error());
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'Pengingat TTD';
  const body  = data.body  || 'Saatnya minum tablet tambah darah.';
  const icon  = data.icon  || '/icon-192.png';
  const badge = data.badge || '/icon-192.png';
  const tag   = data.tag   || 'ttd-reminder';

  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, tag,
      data: data.data || {}
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification?.data?.url) || '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) { client.focus(); return; }
    }
    if (clients.openWindow) await clients.openWindow(urlToOpen);
  })());
});
