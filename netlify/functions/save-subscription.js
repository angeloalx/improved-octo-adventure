// netlify/functions/send-reminders.js
// Kirim Web Push ke semua subscription yang "jatuh tempo"
// CJS style (compat Netlify Functions)

const webpush = require('web-push');
const { blobStore } = require('@netlify/blobs');

const VAPID_PUBLIC = process.env.PUBLIC_VAPID_KEY || '';
const VAPID_PRIVATE = process.env.PRIVATE_VAPID_KEY || '';

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// toleransi menit supaya gak miss kalau cron tiap 5 menit
const WINDOW_MINUTES = 3;

function nowInTZ(tz) {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'Asia/Jakarta' }));
}
function minutesDiff(a, b) { return Math.abs((a - b) / 60000); }

function isDue(now, sched, tz = 'Asia/Jakarta') {
  const local = nowInTZ(tz);

  if (sched.type === 'weekly') {
    // sched: {type:'weekly', days:[0-6], hour, minute}
    if (!Array.isArray(sched.days) || !sched.days.includes(local.getDay())) return false;
    const target = new Date(local);
    target.setHours(sched.hour ?? 8, sched.minute ?? 0, 0, 0);
    return minutesDiff(local, target) <= WINDOW_MINUTES;
  }

  if (sched.type === 'burst') {
    // sched: {type:'burst', from:'YYYY-MM-DD', days:7, hour, minute}
    if (!sched.from) return false;
    const start = new Date(`${sched.from}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + (sched.days ?? 1) - 1);
    if (local < start || local > end) return false;

    const target = new Date(local);
    target.setHours(sched.hour ?? 7, sched.minute ?? 0, 0, 0);
    return minutesDiff(local, target) <= WINDOW_MINUTES;
  }

  return false;
}

exports.handler = async (event) => {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return { statusCode: 500, body: 'Missing VAPID keys in ENV' };
    }

    const store = blobStore('subscriptions', { consistency: 'strong' });
    const listing = await store.list();
    const now = new Date();
    let sent = 0, total = 0;

    for (const item of listing.blobs || []) {
      const raw = await store.get(item.key);
      if (!raw) continue;

      let rec;
      try { rec = JSON.parse(raw.toString('utf-8')); } catch { continue; }

      const { endpoint, keys, schedules = [], tz, lang } = rec || {};
      if (!endpoint || !keys || !schedules.length) continue;

      for (const sched of schedules) {
        total++;
        if (!isDue(now, sched, tz)) continue;

        const subscription = { endpoint, keys };
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: sched.label || 'Pengingat TTD',
              body: 'Waktunya minum tablet 💊',
              tag: 'ttd-reminder',
              data: { url: '/' } // jika notifikasi diklik
            })
          );
          sent++;
        } catch (e) {
          // log error, lanjutkan subscription lain
          console.error('push error', e?.statusCode, e?.body || e?.message);
        }
      }
    }

    return { statusCode: 200, body: `ok sent=${sent} checked=${total}` };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: `error ${e?.message || e}` };
  }
};
