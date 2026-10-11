---
doc: Brief owner (dari percakapan ChatGPT)
title: Bahan Konteks — GEMA RnD
date: 2026-10-11
status: Diterima; spesifikasi pendamping `arsitektur-GEMA-RnD.md` BELUM ada di repo
related: [PRD_RnD.md, schema_rnd.sql, parameter_kora_draft.csv]
---

# Bahan Konteks untuk Claude — GEMA RnD

## Tentang proyek
Owner sedang belajar vibe coding dan ingin studio kerja digital **GEMA RnD**. Jelaskan dengan bahasa Indonesia sederhana, contoh nyata, satu langkah kecil per giliran, tanpa banjir jargon.

## Fokus R&D — lima jalur
1. Kopra edibel 2. Cuka air kelapa 3. Bioleather dari air kelapa 4. Arang 5. Briket

## Tujuan studio digital
- **Otak:** arah, fokus aktif, keputusan
- **Agen:** asisten dengan peran & batas jelas
- **Library:** SOP, referensi, template, pengetahuan terkurasi
- **Sistem saraf:** alur penghubung tugas, catatan, hasil, alat
- **Second brain:** catatan permanen yang bisa dicari & ditautkan
- **Backup:** salinan terpisah untuk pemulihan

Tahap pertama: buku catatan eksperimen digital — dashboard lima jalur, formulir eksperimen, bahan/batch, kondisi proses, pengamatan, foto/berkas, kesimpulan, langkah berikutnya.

## Keputusan desain sementara
- Mulai kecil, satu pengguna; belum banyak agen/otomasi.
- Tiap eksperimen disimpan terpisah, tidak menimpa yang lama.
- Pisahkan catatan mentah, ringkasan pengetahuan, dan backup.
- Hasil buatan agen = draf untuk diperiksa owner.
- AI boleh merapikan & membandingkan eksperimen dengan menyebut ID/sumber.
- Jangan mengarang data eksperimen / klaim aman-dikonsumsi. Kosong ditandai "belum dicatat".

## Cara kerja
1. Kerjakan satu fitur kecil per giliran.
2. Sebelum mengedit: sebut singkat apa yang diubah; sesudahnya: cara mencoba dengan bahasa sederhana.
3. Ketidakpastian penting → pertanyaan, bukan tebakan.
4. Pertahankan ekspor & backup; jangan hapus/ganti data eksperimen tanpa izin.

## Protokol riset R&D
- Klaim teknis (bahan, proses, mutu, keamanan, uji, regulasi) wajib dicari & diverifikasi sumbernya.
- Utamakan sumber primer/otoritatif (peer-reviewed, standar resmi, regulator, paten, laporan lab). Blog/toko/forum bukan bukti utama.
- Cantumkan judul, penulis/lembaga, tahun, DOI/URL, jenis sumber, apa yang diuji, keterbatasan, relevansi.
- Label bukti: belum ditelusuri · didukung satu sumber · didukung beberapa sumber · metodenya diuji pada kondisi mirip · belum tervalidasi untuk kondisi GEMA RnD. Jangan tulis "tervalidasi" tanpa siapa/apa/metode/lingkup.
- Jangan samakan: satu eksperimen vs replikasi; peer-reviewed vs validasi komersial; paten vs bukti aman; "alami/tradisional" vs aman; uji bahan vs izin edar.
- Tak cukup bukti → "belum ditemukan bukti yang cukup". Jangan buat DOI/kutipan/regulasi palsu.
- Catatan sumber di library: `source_id`, judul, penulis/lembaga, tahun, jenis, DOI/URL, tanggal akses, produk/topik, klaim didukung, kondisi/metode, keterbatasan, status pemeriksaan, konflik; ditautkan ke eksperimen/keputusan.
