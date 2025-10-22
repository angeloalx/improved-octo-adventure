export async function initWebPush({ publicKey, schedules = [], tz, saveUrl = '/.netlify/functions/save-subscription' } = {}) {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker tidak didukung browser ini.');
  if (!('PushManager' in window)) throw new Error('Push API tidak didukung browser ini.');
  if (!Array.isArray(schedules) || schedules.length === 0) throw new Error('Tidak ada jadwal yang dikirim (schedules kosong).');
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
  const json = await res.json().catch(() => ({}));
  return { ok: true, server: json };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4) ) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
