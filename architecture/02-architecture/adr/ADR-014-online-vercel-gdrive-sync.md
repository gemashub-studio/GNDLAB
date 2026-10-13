# ADR-014 — Online gratis: Vercel + sinkron Google Drive

- Status: diterima (owner 2026-10-13: "buat semuanya online … gratis plus bisa simpan data base, coba gunakan gdrive")
- Melanjutkan: ADR-012 (lab offline di perangkat), opsi C di `07-rnd/sinkronisasi-opsi.md`

## Keputusan
1. Aplikasi di-host di **Vercel Hobby** (akun owner). Build tanpa `DATABASE_URL` lulus; halaman yang butuh Postgres (`/masuk`, API dataset/usulan) belum aktif online.
2. Data lab tetap **IndexedDB per perangkat** (offline-first). Sinkronnya memakai **satu file JSON di Google Drive owner** (format cadangan lab v2 + `deleted`), lewat Google Identity Services dengan izin `drive.file`. Tidak ada server atau database pihak ketiga yang dipakai.
3. Aturan penggabungan (`labSync.planSync`):
   - catatan resmi hanya ditambah, tidak ditimpa;
   - draf dan laporan belanja: `updatedAt` paling baru menang;
   - penghapusan disimpan sebagai nisan;
   - ID kembar dengan `createdAt` berbeda dilaporkan sebagai konflik dan tidak digabung.
4. Setelah sinkron aktif, ID baru diberi **kode perangkat** 2 karakter (`device.ts`), diawali huruf supaya angka urutnya tetap terbaca.
5. Client ID OAuth dibuat owner di Google Cloud. Client ID bukan rahasia, dan bisa ditempel di aplikasi (localStorage) atau dipasang sebagai `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Konsekuensi
- Gratis selama kuota Vercel Hobby dan Drive 15 GB cukup. Video besar membuat file sinkron besar.
- Sinkron berjalan manual (tombol), tanpa sinkron latar belakang.
- Login atau database server online masih perlu keputusan terpisah, karena butuh akun baru.
