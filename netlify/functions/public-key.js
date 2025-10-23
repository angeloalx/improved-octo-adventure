// netlify/functions/public-key.js
exports.handler = async () => {
  const key = process.env.PUBLIC_VAPID_KEY || "";
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify({ publicKey: key })
  };
};
