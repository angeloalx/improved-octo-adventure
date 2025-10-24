export default async (req) =>
  new Response(`SUBS-V2-OK method=${req.method} ts=${Date.now()}`, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
