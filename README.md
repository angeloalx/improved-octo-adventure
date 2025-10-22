# Web Push Schedules — Netlify Functions (Per-User + Burst, Dedupe)

- Jadwal **per-user** (weekly & burst) via `schedules[]`
- **Deduplication** per hari (anti dobel)
- Scheduled sender tiap 15 menit, window default 10 menit

## Struktur
- `netlify.toml` — jadwal function `send-reminders` (*/15)
- `netlify/functions/save-subscription.js` — simpan { subscription, tz, schedules[] } ke Netlify Blobs
- `netlify/functions/send-reminders.js` — cek jadwal per user & kirim push
- `public/js/subscribe.js` — helper frontend subscribe & kirim schedules[]

## Contoh frontend
```html
<button id="enablePush">Aktifkan Pengingat Background</button>
<script type="module">
  import { initWebPush } from '/js/subscribe.js';
  document.getElementById('enablePush').onclick = async () => {
    const schedules = [
      { type:'weekly', days:[1,3,5], hour:8, minute:0, label:'TTD mingguan' },
      { type:'burst', from:'2025-10-22', days:5, hour:7, minute:0, label:'TTD saat haid' }
    ];
    const res = await initWebPush({
      publicKey: '<PUBLIC_VAPID_KEY>',
      schedules,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    alert('Push aktif: ' + JSON.stringify(res));
  };
</script>
```

## Env Netlify
- `PUBLIC_VAPID_KEY`, `PRIVATE_VAPID_KEY` (wajib)
- `VAPID_SUBJECT` (opsional)
- `SEND_WINDOW_MINUTES` (opsional, default 10)

## Catatan
- iOS: butuh PWA di Home Screen (iOS 16.4+), Android didukung luas.
- `lastSent` mencegah dobel kirim dalam 1 hari per schedule (H & H-1).
- Untuk hapus: bisa buat function `delete-subscription.js` yang menghapus blob `subs/<id>.json`.
