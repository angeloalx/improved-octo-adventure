// netlify/functions/send-reminders.js
const webpush = require('web-push');
const { blobStore } = require('@netlify/blobs');

const VAPID_PUBLIC = process.env.PUBLIC_VAPID_KEY || '';
const VAPID_PRIVATE = process.env.PRIVATE_VAPID_KEY || '';

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// toleransi menit utk cron (mis. cron tiap 5 menit)
const WINDOW_MINUTES = Number(process.env.SEND_WINDOW_MINUTES || 5);

function nowInTZ(tz) {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'Asia/Jakarta' }));
}
function minutesDiff(a, b) { return Math.abs((a - b) / 60000); }

function isDue(now, sched, tz='Asia/Jakarta') {
  const local = nowInTZ(tz);

  if (sched.type === 'weekly') {
    const days = Array.isArray(sched.days) ? sched.days.map(Number) : [];
    if (!days.includes(local.getDay())) return false;
    const h = Number(sched.hour ?? 8);
    const m = Number(sched.minute ?? 0);
    const target = new Date(local); target.setHours(h, m, 0, 0);
    return minutesDiff(local, target) <= WINDOW_MINUTES;
  }

  if (sched.type === 'burst') {
    if (!sched.from) return false;
    const start = new Date(`${sched.from}T00:00:00`);
    const len = Number(sched.days ?? 1);
    const end = new Date(start); end.setDate(end.getDate() + len - 1);
    if (local < start || local > end) return false;
    const h = Number(sched.hour ?? 7);
    const m = Number(sched.minute ?? 0);
    const target = new Date(local); target.setHours(h, m, 0, 0);
    return minutesDiff(local, target) <= WINDOW_MINUTES;
  }

  return false;
}

exports.handler = async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return { statusCode: 500, body: 'Missing VAPID keys' };
  }

  const store = blobStore('subscriptions', { consistency: 'strong' });
  const list = await store.list();
  const now = new Date();
  let sent = 0, checked = 0, deleted = 0, errors = 0;

  for (const item of list.blobs || []) {
    const buf = await store.get(item.key);
    if (!buf) continue;
    let rec;
    try { rec = JSON.parse(buf.toString('utf-8')); } catch { continue; }

    const { endpoint, keys, schedules = [], tz } = rec || {};
    if (!endpoint || !keys || !schedules.length) continue;

    for (const sched of schedules) {
      checked++;
      if (!isDue(now, sched, tz)) continue;

      const subscription = { endpoint, keys };
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: sched.label || 'Pengingat TTD',
            body: 'Waktunya minum tablet 💊',
            tag: 'ttd-reminder',
            data: { url: '/' }
          })
        );
        sent++;
      } catch (e) {
        errors++;
        // 410 Gone: hapus subscription mati
        if (e?.statusCode === 410 || /gone/i.test(e?.body || '')) {
          await store.delete(item.key).catch(()=>{});
          deleted++;
        }
        // lanjut ke yang lain
      }
    }
  }

  return {
    statusCode: 200,
    body: `ok sent=${sent} checked=${checked} deleted=${deleted} errors=${errors}`
  };
};
