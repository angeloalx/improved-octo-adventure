// netlify/functions/save-subscription.js
// CommonJS (Functions v1 style) + Blobs context for Lambda mode

const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

function ok(body = 'saved') {
  return {
    statusCode: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'text/plain; charset=utf-8',
    },
    body,
  };
}
function err(status, msg) {
  return {
    statusCode: status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'text/plain; charset=utf-8',
    },
    body: msg,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok('');
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  // ⬇️ Wajib untuk Functions v1 (Lambda-compat)
  connectLambda(event);

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return err(400, 'Invalid JSON'); }

  const { endpoint, keys, schedules = [], tz = 'Asia/Jakarta', ua } = payload || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return err(400, 'Missing endpoint/keys');

  const id = crypto.createHash('sha256').update(endpoint).digest('hex');
  const store = getStore('subscriptions'); // ← API yang benar (bukan blobStore)

  const record = {
    endpoint,
    keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
    schedules: Array.isArray(schedules) ? schedules : [],
    tz,
    ua: ua || '',
    ts: Date.now(),
  };

  await store.setJSON(id, record); // ← cara simpan JSON resmi
  return ok('saved');
};
