// netlify/functions/send-reminders.js (Functions v2, ESM)
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const VAPID_PUBLIC  = process.env.PUBLIC_VAPID_KEY  || '';
const VAPID_PRIVATE = process.env.PRIVATE_VAPID_KEY || '';
const WINDOW_MINUTES = Number(process.env.SEND_WINDOW_MINUTES || 5);

webpush.setVapidDetails('mailto:you@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

function nowInTZ(tz) {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz || 'Asia/Jakarta' }));
}
function minutesDiff(a, b) { return Math.abs((a - b) / 60000); }

function isDue(sched, tz='Asia/Jakarta') {
  const local = nowInTZ(tz);

  if (sched?.type === 'weekly') {
    const days = Array.isArray(sched.days) ? sched.days.map(Number) : [];
    if (!days.includes(local.getDay())) return false;
    const h = Number(sched.hour ?? 8), m = Number(sched.minute ?? 0);
    const t = new Date(local); t.setHours(h, m, 0, 0);
    return minutesDiff(local, t) <= WINDOW_MINUTES;
  }

  if (sched?.type === 'burst') {
    if (!sched.from) return false;
    const start = new Date(`${sched.from}T00:00:00`);
    const len = Number(sched.days ?? 1);
    const end = new Date(start); end.setDate(end.getDate() + len - 1);
    if (local < start || local > end) return false;
    const h = Number(sched.hour ?? 7), m = Number(sched.minute ?? 0);
    const t = new Date(local); t.setHours(h, m, 0, 0);
    return minutesDiff(local, t) <= WINDOW_MINUTES;
  }

  return false;
}

export default async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response('Missing VAPID keys', { status: 500, headers: { 'content-type': 'text/plain' } });
  }

  const store = getStore('subscriptions');
  const { blobs = [] } = await store.list();

  let sent = 0, checked = 0, deleted = 0, errors = 0;

  for (const { key } of blobs) {
    const rec = await store.getJSON(key);
    if (!rec) continue;

    const { endpoint, keys, schedules = [], tz } = rec;
    if (!endpoint || !keys || !schedules.length) continue;

    for (const sched of schedules) {
      checked++;
      if (!isDue(sched, tz)) continue;

      try {
        await webpush.sendNotification(
          { endpoint, keys },
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
        if (e?.statusCode === 410) { // subscription mati
          await store.delete(key).catch(() => {});
          deleted++;
        }
      }
    }
  }

  return new Response(
    `ok sent=${sent} checked=${checked} deleted=${deleted} errors=${errors}`,
    { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
  );
};
