// netlify/functions/save-subscription.js (Functions v2, ESM)
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: CORS });

  let payload;
  try { payload = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: CORS }); }

  const { endpoint, keys, schedules = [], tz = 'Asia/Jakarta', ua } = payload || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return new Response('Missing endpoint/keys', { status: 400, headers: CORS });
  }

  const id = createHash('sha256').update(endpoint).digest('hex');
  const store = getStore('subscriptions');

  const record = {
    endpoint,
    keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
    schedules: Array.isArray(schedules) ? schedules : [],
    tz,
    ua: ua || '',
    ts: Date.now()
  };

  await store.setJSON(id, record);
  return new Response('saved', { status: 200, headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8' } });
};
