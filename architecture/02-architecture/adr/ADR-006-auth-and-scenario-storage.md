# ADR-006: Login magic link (sesi JWT) + penyimpanan skenario offline-first

- **Status:** Accepted
- **Tanggal:** 2026-10-09
- **Terkait:** HANDOFF §6 (Autentikasi), ARD §6–§8, ERD `APP_USER`, `SCENARIO`, FR-10, NFR-03

## Konteks
HANDOFF §6 menyarankan NextAuth email magic link; login hanya untuk menyimpan skenario & kalibrasi, kalkulator tetap publik/offline. Adapter NextAuth bawaan membutuhkan tabel `user/account/session` yang tidak ada di `schema.sql`; skema tidak boleh diubah sembarangan.

## Keputusan
1. **next-auth 4 (stabil) + Email provider, sesi JWT.** Adapter kustom di atas `app_user` (email unik, peran). Satu-satunya tabel tambahan: `auth_verification_token` (migrasi `0002_auth`), `schema.sql` tetap disalin apa adanya sebagai migrasi `0001_schema` (dijaga test byte-equal).
2. Peran awal `editor`; email di `ADMIN_EMAILS` → `data_admin`. Peran dibaca dari DB saat login.
3. **Skenario offline-first:** disimpan dulu di IndexedDB dengan UUID buatan client; UUID itu dipakai sebagai `scenario.id` saat sinkron → sinkron ulang/paralel idempoten (unique violation ditangani).
4. Server SELALU menghitung ulang (ARD §7) lalu menulis `scenario` + `scenario_override` + `calc_result` dalam satu transaksi; `input` = `{name, state}`.
5. Akses: by `share_slug` publik (tautan bagikan); by UUID hanya pemilik.
6. Mode dev tanpa SMTP: tautan masuk dicetak di log server; produksi wajib `EMAIL_SERVER`. Batas 3 permintaan/15 menit per email (in-memory).

## Konsekuensi
- (+) Skema inti tidak berubah; kalkulator & simpan lokal tetap jalan tanpa akun/sinyal.
- (−) Perubahan peran berlaku setelah login ulang (JWT). Rate limit in-memory tidak berlaku lintas instance (ISS-022).
