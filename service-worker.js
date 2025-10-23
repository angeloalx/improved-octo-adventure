// service-worker.js — clean & minimal
self.addEventListener('install', (e) => {
  // update segera begitu SW baru ada
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // ambil kontrol semua client yang terbuka
  e.waitUntil(self.clients.claim());
});

// TIDAK melakukan caching agresif untuk menghindari index.html basi.
// (Kalau perlu offline, kita bisa tambahkan nanti secara selektif.)

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    const txt = event.data ? event.data.text() : '';
    data = { title: 'Pengingat', body: txt, data: {} };
  }

  const title = data.title || 'Pengingat';
  const body = data.body || '';
  const tag = data.tag || 'ttd';
  const notifData = data.data || { url: '/' };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: notifData,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => new URL(c.url).pathname === url);
      return existing ? existing.focus() : clients.openWindow(url);
    })
  );
});
