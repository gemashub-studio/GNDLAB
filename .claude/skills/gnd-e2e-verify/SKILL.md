---
name: gnd-e2e-verify
description: Menjalankan & menulis uji Playwright E2E GnD Lab / gemasSTUDIO di server web-e2e (port 3210), termasuk tiruan API (Groq, TTS, Lab AI), isi IndexedDB, screenshot tata letak, dan menangani flake server dev. Pakai setelah mengubah UI yang bisa dilihat di browser, atau saat E2E gagal.
---

# Verifikasi E2E gemasSTUDIO

## Server
- Konfigurasi `.claude/launch.json` → `web-e2e` (`node apps/web/e2e/dev-server.mjs`, port 3210, **tanpa Supabase** →
  login tidak wajib, `requireLabUser` lolos). `GROQ_API_KEY` ada di `apps/web/.env` lokal; kunci lain (OpenRouter,
  GROQ_API_KEY_2..5) hanya di Vercel (rahasia tidak bisa ditarik: `vercel env run` memberi nilai kosong).
- Server dev lambat saat kompilasi dingin → **hangatkan rute dulu**:
  `for r in / "/lab?t=bahan" "/lab?t=protokol" "/lab?t=belanja" "/lab?t=gabung" /muat /gudang /proses /konversi /data; do curl -s -o /dev/null --max-time 240 "http://localhost:3210$r"; done`
- `.next` kadang korup di Windows (UNKNOWN -4094) → hentikan server, hapus `.next`, mulai lagi.

## Menjalankan
- Dari `apps/web`: `npx playwright test e2e/<file>.spec.ts --project=desktop --reporter=line`.
- Suite penuh desktop ±15 menit → jalankan di latar (run_in_background) dan tulis keluaran ke scratchpad; jangan ubah kode
  saat suite berjalan (server mengompilasi ulang → flake).
- Gagal sekali karena ERR_ABORTED / waktu habis kompilasi → hangatkan rute & ulang tes tunggal sebelum menyimpulkan bug.
  Laporkan angka lulus/gagal apa adanya.

## Pola uji yang sudah ada
- Tiruan: `page.route('**/api/voice-assistant'|'**/api/voice-tts'|'**/api/lab-ai'|'**/api/voice-transcribe', …)`;
  TTS dibalas WAV hening (lihat `e2e/voice-assistant.spec.ts`, simpan `spoken`/`voices`).
- Asisten kelapa dipaksa tampil: `localStorage.setItem('gnd-va-force','1')`; kartu sambutan dilewati: `gnd-va:local='nanti'`.
- Mikrofon palsu: `launchOptions.args ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']`.
- Isi data tanpa UI: `indexedDB.open('gemas-catat', 1)` store `records` (keyPath `id`); belanja `gemas-belanja` store `reports`
  (objek LPJ lengkap — lebih aman dibuat lewat UI).
- Menu GnD Lab = OptionWheel: opsi `lab-tab-<id>` (role option, `aria-selected`); klik lewat kode pakai `dispatchEvent('click')`.
- Dropdown: buka `<testId>`, pilih `<testId>-opt-<value>`.

## Screenshot / ukur tata letak
Buat spec sementara (`e2e/shotN.spec.ts`, hapus setelahnya) yang `page.screenshot({ path: process.env.SHOT })` atau
`evaluate(getBoundingClientRect)` lalu `console.log` angka; jalankan dengan variabel env SHOT/DIR ke scratchpad, lalu Read PNG.
`scrollIntoViewIfNeeded` menyejajarkan tepi bawah elemen dengan viewport — perhitungkan saat membaca koordinat.
