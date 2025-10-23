// netlify/functions/save-subscription.js
const { blobStore } = require('@netlify/blobs');
const crypto = require('crypto');

function ok(body = 'ok') {
  return {
    statusCode: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'text/plain; charset=utf-8'
    },
    body
  };
}
function bad(status, msg) {
  return {
    statusCode: status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'text/plain; charset=utf-8'
    },
    body: msg
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok();

  if (event.httpMethod !== 'POST') {
    return bad(405, 'Method Not Allowed');
  }

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return bad(400, 'Invalid JSON'); }

  const { endpoint, keys, schedules = [], tz, ua, ts } = payload || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return bad(400, 'Missing endpoint/keys');
  }

  // Key blob: hash endpoint → idempotent
  const id = crypto.createHash('sha256').update(endpoint).digest('hex');

  const record = {
    endpoint,
    keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
    schedules: Array.isArray(schedules) ? schedules : [],
    tz: tz || 'Asia/Jakarta',
    ua: ua || '',
    ts: ts || Date.now()
  };

  const store = blobStore('subscriptions', { consistency: 'strong' });
  await store.setJSON(id, record);

  return ok('saved');
};
