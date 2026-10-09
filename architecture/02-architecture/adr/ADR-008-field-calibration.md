# ADR-008: Kalibrasi lapangan → versi dataset patch di database

- **Status:** Accepted
- **Tanggal:** 2026-10-09
- **Terkait:** PRD US-08 / FR-11 / §8; ADR-002 (dataset berversi), ADR-003 (rentang), IR-02, IR-03, IR-07, IR-08; `CLAUDE_CODE_PROMPT.md` §4 (M4)

## Konteks
Fase M4 mengizinkan data sampling gudang mengoreksi angka dataset. Dataset inventory di repo (`00-research/data/coconut_inventory_dataset.json` v1.0.4) dan golden cases adalah kontrak yang tidak boleh diedit oleh aplikasi; versi `PUBLISHED` di database immutable (IR-02). Skenario lama wajib tetap reproducible dengan versi datasetnya sendiri.

## Keputusan
1. **Sampel** disimpan sebagai `MEASUREMENT` per parameter versi aktif (editor/data_admin; viewer ditolak). Impor CSV mengikuti `logs/field_sampling_template.csv` persis dan bersifat **semua-atau-tidak** (satu baris salah → tidak ada yang tersimpan). Sampel dikelompokkan lintas versi dengan **kunci alami** `komoditas|bentuk|parameter`.
2. **Usulan otomatis** saat n ≥ 10: `{min = P5, typ = median, max = P95}` (persentil R-7, `calc-engine/stats.ts`), satu `CALIBRATION_PROPOSAL` PENDING per parameter; sampel baru memperbarui usulan yang sama.
3. **Approval** hanya `data_admin` (IR-07). Persetujuan, dalam satu transaksi:
   salin seluruh data referensi versi aktif → versi baru (semver **patch +1**) dengan nilai usulan berkeyakinan **A** → versi lama `is_active = false` tetapi tetap `PUBLISHED` & utuh → versi baru `PUBLISHED` & aktif → usulan `APPROVED` + `reviewed_by` + `resulting_version_id`. Aktor dicatat lewat `set_config('app.actor_id')` → `audit_log` (IR-08).
4. **Dataset di aplikasi** = bundel basis (v1.0.4, dari repo) + **override parameter** yang berbeda di versi DB (`dataset/overrides.ts`). Client menerima override lewat `/api/v1/datasets/active` dan menyimpannya untuk offline. File JSON di repo TIDAK diubah oleh kalibrasi.
5. **Realisasi muat**: muat aktual vs prediksi engine (target |selisih| ≤ 10 %, PRD §8); bila container penuh secara volume dan tidak dibatasi berat, densitas tersirat `massa ÷ (V·u)` dapat disimpan sebagai sampel `bulk_density` metode `realisasi_stuffing`.

## Konsekuensi
- (+) Skenario lama menghitung ulang dengan versinya (diuji di DB test & E2E); golden cases tetap terhadap v1.0.4.
- (+) Riwayat perubahan angka dapat dilacak: changelog versi DB, usulan, sampel tertaut (`proposal_measurement`), audit log.
- (−) Setiap persetujuan menyalin seluruh data referensi (±beberapa ratus baris) — dapat diterima untuk frekuensi kalibrasi rendah (±4 detik di dev).
- (−) Versi DB hasil kalibrasi tidak otomatis kembali ke file JSON repo; sinkronisasi ke dataset repo (rilis dataset baru + golden baru) adalah langkah manual owner bila diinginkan.
- Pengujian alur yang mengubah versi aktif dijalankan HANYA di database test terpisah (`gemas_test`).
