// public/js/subscribe.js
// ES Module – clean slate
// Fungsinya:
//   1) fetchPublicKey(): ambil VAPID public key dari Netlify Function
//   2) initWebPush({ publicKey, schedules, tz, saveUrl, swUrl }): subscribe & simpan ke server

const DEBUG = false;

/* =========================
 * Utils
 * =======================*/

// Normalisasi dan cek base64url
function sanitizeBase64Url(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, ""); // buang spasi/newline
}

function isLikelyBase64Url(str) {
  return /^[A-Za-z0-9\-_]+$/.test(str);
}

function urlBase64ToUint8Array(base64String) {
  base64String = sanitizeBase64Url(base64String);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function log(...args) {
  if (DEBUG) console.debug("[push]", ...args);
}

/* =========================
 * Public API
 * =======================*/

/**
 * Ambil VAPID public key dari function.
 * Mengerti 2 format respons:
 *  - JSON: { publicKey: "..." }
 *  - text/plain: "...."
 */
export async function fetchPublicKey(endpoint = "/.netlify/functions/public-key") {
  const r = await fetch(endpoint, { cache: "no-store" });
  let key = "";
  try {
    const j = await r.clone().json();
    key = j.publicKey || "";
  } catch {
    key = await r.text();
  }
  key = sanitizeBase64Url(key);
  if (!key || !isLikelyBase64Url(key)) {
    throw new Error("VAPID public key tidak valid (format base64url).");
  }
  return key;
}

/**
 * Ambil/daftarkan Service Worker.
 * - Jika sudah ada, pakai.
 * - Jika belum ada, coba register ke swUrl.
 */
async function ensureSW(swUrl = "/service-worker.js") {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Browser tidak mendukung Service Worker.");
  }
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register(swUrl);
    } catch (e) {
      throw new Error("Gagal register Service Worker: " + (e?.message || e));
    }
  }
  // Pastikan aktif
  await navigator.serviceWorker.ready;
  reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("Service Worker belum siap.");
  return reg;
}

/**
 * Minta izin notifikasi jika belum.
 */
async function ensureNotificationPermission() {
  if (!("Notification" in window)) {
    throw new Error("Browser tidak mendukung Notification API.");
  }
  if (Notification.permission === "granted") return;
  if (Notification.permission === "denied") {
    throw new Error("Izin notifikasi ditolak pengguna.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Izin notifikasi tidak diberikan.");
}

/**
 * Subscribe push dan kembalikan subscription (endpoint+keys).
 */
async function getOrCreateSubscription(reg, publicKey) {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const appServerKey = urlBase64ToUint8Array(publicKey);
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  } catch (e) {
    // Error klasik saat key salah/ada karakter ilegal
    if (String(e?.message || "").toLowerCase().includes("invalid character")) {
      throw new Error(
        "VAPID key tidak valid (invalid character). Pastikan key adalah base64url tanpa spasi/newline."
      );
    }
    throw e;
  }
}

/**
 * Simpan subscription + jadwal ke server.
 */
async function saveSubscription(saveUrl, payload) {
  const r = await fetch(saveUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("Gagal menyimpan subscription: " + r.status + " " + t);
  }
  return r.text().catch(() => "ok");
}

/**
 * Inisialisasi Web Push:
 * - ambil/cek SW
 * - minta izin notifikasi
 * - subscribe push
 * - simpan subscription + jadwal ke Netlify Function
 */
export async function initWebPush({
  publicKey,
  schedules = [],
  tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
  saveUrl = "/.netlify/functions/save-subscription",
  swUrl = "/service-worker.js",
} = {}) {
  if (!publicKey) throw new Error("publicKey wajib diisi.");

  // Bersihkan jadwal agar selalu aman
  const normSchedules = (Array.isArray(schedules) ? schedules : [])
    .filter(Boolean)
    .map((s) => {
      const o = { ...s };
      if (o.type === "weekly") {
        o.days = Array.isArray(o.days) ? o.days.map((d) => Number(d)) : [];
        o.hour = Number(o.hour ?? 8);
        o.minute = Number(o.minute ?? 0);
      } else if (o.type === "burst") {
        o.days = Number(o.days ?? 1);
        o.hour = Number(o.hour ?? 7);
        o.minute = Number(o.minute ?? 0);
      }
      return o;
    });

  // 1) SW
  const reg = await ensureSW(swUrl);
  log("SW ready", reg);

  // 2) Permission
  await ensureNotificationPermission();

  // 3) Subscribe
  const sub = await getOrCreateSubscription(reg, publicKey);
  const json = sub.toJSON ? sub.toJSON() : null;
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    throw new Error("Subscription tidak lengkap (endpoint/keys).");
  }

  // 4) Simpan ke server
  const payload = {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    schedules: normSchedules,
    tz,
    ua: navigator.userAgent,
    ts: Date.now(),
  };

  const resText = await saveSubscription(saveUrl, payload);
  log("saved", resText);

  return { registration: reg, subscription: json, saved: true, response: resText };
}
