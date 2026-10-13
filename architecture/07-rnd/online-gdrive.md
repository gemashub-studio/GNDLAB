# gemasSTUDIO online (gratis) + data di Google Drive

Keputusan: DEC-065 (2026-10-13). Owner minta "semuanya online, gratis, simpan data pakai Google Drive".

## Bentuknya

| Bagian | Layanan | Biaya |
|---|---|---|
| Aplikasi (semua halaman) | **Vercel**, paket Hobby, akun owner yang sudah terhubung | Gratis |
| Data lab (eksperimen, riset produk, laporan belanja, foto/video) | **Google Drive owner**: satu file JSON bernama gemasSTUDIO-lab-sinkron (di Drive, bukan di repo) | Gratis (kuota Drive 15 GB) |
| Login & database server (Postgres: kalibrasi, usulan dataset, skenario tersimpan di server) | Belum diaktifkan online | — |

Data tetap tersimpan di browser tiap perangkat, jadi aplikasi tetap jalan tanpa internet. Tombol **Sinkronkan dengan Google Drive** ada di `/lab` → tab Ringkasan. Saat ditekan:
1. aplikasi mengambil file di Drive;
2. menggabungkannya ke perangkat ini;
3. mengunggah hasil gabungan kembali ke Drive.

Tekan tombol itu di laptop dan di HP.

Aturan penggabungan:
- **Catatan resmi** (versi riset, laporan harian, media) tidak pernah ditimpa. Yang belum ada ditambahkan.
- **Draf dan laporan belanja:** versi yang paling baru disimpan yang menang.
- **Penghapusan** ikut ke perangkat lain. Penghapusan dicatat sebagai "nisan", jadi data yang sudah dihapus tidak muncul lagi.
- **Kode perangkat:** setelah sinkron aktif, ID baru diberi kode perangkat 2 huruf, mis. `KE-P01K7`. Laptop dan HP tidak bisa membuat ID kembar.
- **ID kembar:** kalau data lama dari dua perangkat kebetulan ber-ID sama, sinkron melaporkannya dan tidak menggabungkannya. Tidak ada yang hilang diam-diam.

Keamanan:
- Izin Google hanya `drive.file`, jadi aplikasi **hanya** bisa membuka file yang ia buat sendiri, bukan isi Drive lainnya.
- Token login hanya disimpan di memori.
- Client ID bukan kata sandi.

## Langkah owner (sekali saja)

### 1. Masuk Vercel CLI (agar Claude bisa mengunggah aplikasi)
Di terminal folder proyek, jalankan `npx vercel login`, lalu pilih cara masuk yang sama dengan akun Vercel-mu. Claude tidak pernah melihat kata sandimu.

### 2. Buat Client ID Google (untuk tombol sinkron)
1. Buka https://console.cloud.google.com/, lalu login dengan akun Google yang Drive-nya dipakai.
2. Buat project baru, misalnya "gemasSTUDIO". Gratis, tanpa kartu kredit.
3. Aktifkan Google Drive API: menu **APIs & Services → Library → "Google Drive API" → Enable**.
4. Atur layar persetujuan: **APIs & Services → OAuth consent screen**.
   - Tipe: **External**.
   - Isi nama aplikasi "gemasSTUDIO" dan email-mu.
   - Di **Test users**, tambahkan email Google kamu (dan asisten). Status "Testing" sudah cukup, tidak perlu verifikasi Google.
5. Buat Client ID: **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Tipe: **Web application**.
   - Authorized JavaScript origins: alamat Vercel aplikasi (mis. `https://gemasstudio.vercel.app`) dan `http://localhost:3000`.
   - Tidak perlu redirect URI.
6. Salin **Client ID**, yang berakhiran `.apps.googleusercontent.com`. Tempel di `/lab` → Ringkasan → Sinkron Google Drive → **Aktifkan** (lakukan sekali di tiap perangkat), atau kirim ke Claude untuk dipasang permanen sebagai `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Batasan
- Sinkron berjalan saat tombol ditekan, tidak otomatis di latar belakang.
- Semua data disimpan dalam satu file JSON. Foto/video menjadi base64, kira-kira 1,33× ukuran aslinya. Video besar memperlambat sinkron, jadi rutin cek ukuran yang tertulis di pesan sinkron.
- Halaman `/masuk` (login) dan fitur yang butuh Postgres belum aktif online. Pilihan database server gratis (mis. Neon) butuh akun baru, jadi menunggu keputusan owner.
- Diuji otomatis dengan Google tiruan (`apps/web/e2e/drive-sync.spec.ts`: laptop + HP, gabung, hapus). Uji dengan akun Google sungguhan dilakukan setelah langkah 2.
