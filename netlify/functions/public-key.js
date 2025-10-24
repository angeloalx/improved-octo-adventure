// netlify/functions/public-key.js  (Functions v2, ESM)
export default async () => {
  return new Response(
    JSON.stringify({ publicKey: process.env.PUBLIC_VAPID_KEY || "" }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
};
