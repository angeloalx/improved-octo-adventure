// service-worker.js — clean
// Versi cache dinaikkan agar update selalu keambil
const SW_VERSION = 'ttd-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Terima push & tampilkan notifikasi
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? (event.data.json ? event.data.json() : JSON.parse(event.data.text())) : {};
  } catch {
    data = { title: 'Pengingat', body: event.data && event.data.text ? event.data.text() : '' };
  }

  const title = data.title || 'Pengingat';
  const options = {
    body: data.body || '',
    tag: data.tag || 'ttd-reminder',
    data: data.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Klik notifikasi → buka/fokus tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.some((c) => {
        if (new URL(c.url).pathname === url) {
          c.focus();
          return true;
        }
        return false;
      });
      if (!hadWindow) return self.clients.openWindow(url);
    })
  );
});
