// netlify/functions/public-key.js
exports.handler = async () => {
  const pub = process.env.PUBLIC_VAPID_KEY || '';
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify({ publicKey: pub })
  };
};
