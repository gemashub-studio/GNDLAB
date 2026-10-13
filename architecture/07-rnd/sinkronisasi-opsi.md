# Opsi sinkronisasi laptop ↔ HP — GEMA RnD Lab

> **Diperbarui 2026-10-13:** owner memilih online gratis + Google Drive → ADR-014 / DEC-065, panduan `online-gdrive.md`. Tabel di bawah = arsip pertimbangan.

**Status sekarang (2026-10-11):** data **belum tersinkron**. Catatan, foto, dan video tersimpan di browser masing-masing perangkat (IndexedDB). Laptop dan HP punya catatan sendiri-sendiri. Satu-satunya cara memindahkan data: **Unduh cadangan lengkap** di satu perangkat, lalu **Pulihkan** di perangkat lain (hanya menambah, tidak menimpa). Lihat ADR-012.

Belum ada yang dipilih atau dipasang. Semua opsi di bawah butuh persetujuan owner. Tidak ada deploy, akun, atau kunci akses yang dibuat.

| Opsi | Cara kerja (sederhana) | Yang dibutuhkan | Risiko / biaya | Cadangan & pulihkan |
|---|---|---|---|---|
| **A. Manual (sekarang)** | File cadangan dipindah lewat flashdisk, kabel, atau drive pribadi | Tidak ada | Lupa memindah = data beda di tiap perangkat; file berisi video bisa besar | File JSON = cadangan itu sendiri |
| **B. Server gemasSTUDIO sendiri di jaringan lokal** | Laptop menjalankan gemasSTUDIO + Postgres (stack ini **sudah ada**: Prisma, Auth.js magic link — ADR-006); HP membuka laptop lewat Wi-Fi yang sama; lab menyinkron ke tabel server | Tabel lab baru di Postgres + API sinkron + aturan konflik (append-only memudahkan: entri tak pernah berubah); password Postgres lokal (owner yang isi) | Laptop harus menyala & satu jaringan; perlu backup database | `pg_dump` + file cadangan aplikasi |
| **C. Server di cloud** | Sama seperti B, tapi server & database di layanan hosting | Akun hosting & database, domain/HTTPS, login, kebijakan privasi data | Biaya bulanan tergantung penyedia (cek harga saat memilih); data eksperimen keluar dari perangkat | Backup otomatis penyedia + ekspor rutin |

**Saran:** tetap di **A** sampai alur catatan terasa cocok setelah beberapa eksperimen nyata (sesuai spesifikasi §10). Bila sinkron dibutuhkan, **B** paling dekat dengan stack yang sudah ada dan tanpa biaya berulang. **C** hanya bila perlu akses dari luar lokasi lab.
