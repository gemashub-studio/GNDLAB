# ADR-012: GEMA RnD Lab — buku catatan offline: catatan harian append-only, media lokal, protokol berversi, PDF, cadangan

- **Status:** Accepted
- **Tanggal:** 2026-10-11
- **Terkait:** `07-rnd/asal-chatgpt/00-BACA-DULU-untuk-Claude.md` (pembaruan keputusan pengguna), `07-rnd/asal-chatgpt/arsitektur-GEMA-RnD.md` §11–12, `07-rnd/asal-chatgpt/02-prompt-otonom-visual-Claude.md`; DEC-044, DEC-045, DEC-047; ADR-006

## Konteks
Owner memutuskan: tahap awal **offline**; tiap eksperimen punya **laporan harian** dengan foto/video; hasil dikompilasi jadi **PDF dengan tabel & grafik dari data aktual**; owner merancang **resep & proses sendiri** (aplikasi tidak menentukan angka); UI nyaman di HP, dan laptop/HP **belum** tersinkron, jadi perlu cadangan & pulihkan manual.

## Keputusan
1. **Penyimpanan:** IndexedDB `gemas-lab` v2 di browser, dengan store `experiments`, `entries`, `media` (Blob asli), `protocols`. Bukan localStorage, karena video besar. Upgrade v1→v2 hanya menambah store; data v1 tetap utuh (terbukti pada data owner "greenhouse 1").
2. **Catatan harian append-only:** ID `{eksperimen}-H01…`. Tidak ada fungsi ubah atau hapus. Koreksi dibuat sebagai entri baru dengan `correctsEntryId`. Bagian berlabel terpisah: rencana · realisasi · bahan/batch (jumlah = teks persis dari pengguna) · alat · kondisi · hasil ukur mentah (nilai teks + satuan + waktu + kelompok) · penyimpangan · interpretasi · langkah berikutnya · lampiran.
3. **Protokol berversi:** `{produk}-P01-v1`. "Buat versi baru" menyalin isi versi terakhir dan mewajibkan alasan; versi tersimpan tidak bisa diubah. Entri harian menyimpan ID versi yang benar-benar dipakai.
4. **Media:** Blob asli disimpan lokal. Thumbnail JPEG ≤ 480 px (foto: diperkecil; video: bingkai ±0,5 detik) untuk layar & PDF. Video tidak ditanam di PDF, hanya thumbnail + nama berkas.
5. **PDF** (@react-pdf/renderer, di browser): harian per entri & kompilasi per eksperimen. Grafik garis per (variabel, satuan) per kelompok, hanya dari nilai yang bisa dibaca sebagai angka (`parseNum`, sama dengan kolom angka lain). Bila < 2 titik, tertulis "data belum cukup untuk grafik". Nilai non-angka tetap tampil di tabel. Footer menyatakan isi = catatan pengguna, tanpa saran AI, bukan klaim keamanan.
6. **Cadangan:** satu file JSON (`format: gemas-lab`, `version: 2`) berisi semua store, media sebagai base64. **Pulihkan = tambah saja**: ID yang sudah ada dilewati dan dilaporkan; cadangan v1 tetap bisa dipulihkan. Zip (fflate) tidak dipakai karena berarti menambah dependensi tanpa persetujuan owner.
7. **Kolom eksperimen generik** (pertanyaan, tujuan, kondisi, hasil…) adalah lapisan buku catatan sesuai spesifikasi owner. Parameter terukur per produk tetap direncanakan lewat `rnd_param_def` (aturan proyek); saat itu dibuat, hasil ukur bisa memilih variabel dari definisi.

## Konsekuensi
- Laptop dan HP = dua penyimpanan terpisah. Data dipindahkan lewat file cadangan. Opsi sinkronisasi ada di `07-rnd/sinkronisasi-opsi.md`, dan belum ada yang dipilih.
- Cadangan JSON berisi video bisa besar (base64 ≈ 1,33× ukuran asli). Bila jadi masalah, opsi zip butuh persetujuan menambah dependensi.
- Menghapus data situs/browser = data hilang. UI mengingatkan untuk rutin mengunduh cadangan.
