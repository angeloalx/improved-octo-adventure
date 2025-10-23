// netlify/functions/send-reminders.js
const webpush = require('web-push');
const { blobStore } = require('@netlify/blobs');

const VAPID_PUBLIC = process.env.PUBLIC_VAPID_KEY || '';
const VAPID_PRIVATE = process.env.PRIVATE_VAPID_KEY || '';

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// cek apakah sekarang waktu yang “jatuh tempo” utk sebuah jadwal
function isDue(now, sched, tz='Asia/Jakarta') {
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const H = n => String(n).padStart(2,'0');
  const sameHM = (h,m) => local.getHours() === (h||8) && local.getMinutes() === (m||0);

  if (sched.type === 'weekly') {
    return (sched.days || []).includes(local.getDay()) && sameHM(sched.hour, sched.minute);
  }
  if (sched.type === 'burst') {
    // contoh: {type:'burst', from:'2025-10-01', days:14, hour, minute}
    const start = new Date(`${sched.from}T00:00:00`);
    const end = new Date(start); end.setDate(end.getDate() + (sched.days||1) - 1);
    return local >= start && local <= end && sameHM(sched.hour, sched.minute);
  }
  return false;
}

exports.handler = async () => {
  // baca semua subscription di bucket "subscriptions"
  const store = blobStore('subscriptions', { consistency: 'strong' });
  const listing = await store.list();
  let sent = 0;

  for (const item of listing.blobs || []) {
    const raw = await store.get(item.key);
    if (!raw) continue;

    let rec;
    try { rec = JSON.parse(raw.toString('utf-8')); } catch { continue; }
    const { endpoint, keys, schedules = [], tz, lang } = rec || {};
    if (!endpoint || !keys || !schedules.length) continue;

    for (const sched of schedules) {
      if (!isDue(new Date(), sched, tz)) continue;

      const subscription = { endpoint, keys };
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: sched.label || 'Pengingat TTD',
            body: 'Waktunya minum tablet 💊',
            tag: 'ttd-reminder',
            data: { url: '/' } // buka ke halaman utama saat diklik
          })
        );
        sent++;
      } catch (e) {
        console.error('push error', e?.statusCode, e?.body);
      }
    }
  }

  return { statusCode: 200, body: `ok sent=${sent}` };
};