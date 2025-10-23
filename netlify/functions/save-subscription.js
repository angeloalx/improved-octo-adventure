// netlify/functions/save-subscription.js
// Menyimpan subscription & jadwal pengguna ke Netlify Blobs.
// Aman: tidak butuh package tambahan & tidak mengekspos secrets.

const { blobStore } = require('@netlify/blobs');
const crypto = require('crypto');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: 'Invalid JSON' };
    }

    const { endpoint, keys, schedules, tz, ua, lang } = body;

    // Validasi minimum
    if (!endpoint || typeof endpoint !== 'string') {
      return { statusCode: 400, headers: CORS, body: 'Missing endpoint' };
    }
    if (!keys || typeof keys !== 'object') {
      return { statusCode: 400, headers: CORS, body: 'Missing keys' };
    }
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return { statusCode: 400, headers: CORS, body: 'Missing schedules' };
    }

    // Batasi payload agar tidak berlebihan
    if (JSON.stringify(schedules).length > 20_000) {
      return { statusCode: 413, headers: CORS, body: 'Schedules too large' };
    }

    // Gunakan hash endpoint sebagai id (idempotent: 1 user = 1 record)
    const id = crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 48);

    // Simpan ke Netlify Blobs (bucket "subscriptions")
    const store = blobStore('subscriptions', { consistency: 'strong' });

    const record = {
      id,
      endpoint,
      keys,
      schedules,
      tz: tz || 'Asia/Jakarta',
      ua: ua || '',
      lang: lang || 'id-ID',
      updatedAt: new Date().toISOString()
    };

    await store.set(id, JSON.stringify(record), {
      contentType: 'application/json; charset=utf-8',
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, id })
    };
  } catch (err) {
    console.error('save-subscription error:', err);
    return { statusCode: 500, headers: CORS, body: 'Internal Server Error' };
  }
};