// public/js/subscribe.js
export async function initWebPush({ publicKey, schedules = [], tz, saveUrl = '/.netlify/functions/save-subscription' } = {}) {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker tidak didukung.');
  if (!('PushManager' in window)) throw new Error('Push API tidak didukung.');
  if (!Array.isArray(schedules) || schedules.length === 0) throw new Error('Schedules kosong.');
  if (!tz) tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta');

  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak.');

  const reg = await navigator.serviceWorker.ready;

  const appServerKey = publicKey ? urlBase64ToUint8Array(publicKey) : undefined;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });

  const payload = {
    endpoint: sub.endpoint,
    keys: sub.toJSON().keys,
    schedules,
    tz,
    ua: navigator.userAgent,
    lang: navigator.language || 'id-ID'
  };

  const res = await fetch(saveUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Gagal simpan subscription: ${res.status} ${txt}`);
  }
  return await res.json().catch(() => ({}));
}

export async function fetchPublicKey() {
  try {
    const r = await fetch('/.netlify/functions/public-key', { cache: 'no-store' });
    const j = await r.json();
    return (j && j.publicKey) ? String(j.publicKey).trim() : '';
  } catch {
    return '';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
