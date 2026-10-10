# ADR-009: Dataset & engine formula R&D, produksi per shift, dan ceklis (Fase F)

- **Status:** Accepted
- **Tanggal:** 2026-10-10
- **Terkait:** permintaan owner 2026-10-10; ADR-001, ADR-003, ADR-004, ADR-007; `00-research/kora_research.md`; `07-rnd/PRD_RnD.md`

## Konteks
Owner meminta kalkulator formula R&D (kopra, arang, briket shisha/BBQ/custom, cuka air kelapa, bioleather), formula produksi per shift, serta ceklis R&D, QC, dan produk. Sumber utama adalah dokumen internal KORA (SOP Rev 03, modul & form QC, tracker R&D) yang sebagian sudah bersumber literatur, sebagian standar internal, dan sebagian GAP. Validasi menemukan rumus yang salah di dokumen (gula must −16,7%, titrasi 10× untuk NaOH 0,5 N) dan dua nilai dataset proses yang tidak aman (pendinginan arang 1 jam, oven kopra 90 °C).

## Keputusan
1. Parameter formula, laju stasiun kerja, dan ceklis disimpan sebagai **data bersumber** di `00-research/data/coconut_formula_dataset.json` v1.0.0 (setiap angka `{min,typ,max}` + keyakinan + `source_ids`). Standar internal KORA = keyakinan C. Parameter yang sudah ada di dataset proses (KA daging segar) **dirujuk**, tidak disalin.
2. Sumber boleh berupa URL publik **atau** dokumen internal (`doc`, jalur berkas owner). Skema sumber dataset proses ikut diperluas (minimal salah satu wajib).
3. Dataset proses dinaikkan ke **v1.1.0** (K-01 pendinginan arang 8/10/12 jam; K-02 oven kopra 55/68/70 °C). Dataset formula mensyaratkan versi proses yang tepat (`requires_process_dataset`).
4. Engine formula = fungsi murni terpisah per produk (`formula-cuka.ts`, `formula-bioleather.ts`, `formula-briket.ts`, `formula-kopra.ts`, `formula-arang.ts`, `shift.ts`), rentang via evaluasi sudut (ADR-003), keluaran `{result, confidence, warnings, trace}` tanpa `binding` (bukan kalkulasi muat). Rumus dokumen yang terbukti salah **dikoreksi di engine** dan nilai rumus lama tetap dikembalikan sebagai pembanding agar selisihnya terlihat (FND-021/022).
5. Satuan engine diperluas (`L`, `g_L`, `brix`, `C`, `MPa`, `m2`, …) — hanya untuk dataset formula; enum `param_unit` DB tidak berubah.
6. Kode peringatan formula ditambahkan sebagai **ekstensi** calc_spec §6 (seperti `WATER_REMAINDER_CLAMPED` di Fase P): MUST_BRIX_OUT_OF_RANGE, ACETIC_POTENTIAL_LOW, BINDER_ABOVE_RANGE, DOUGH_MOISTURE_OUT_OF_RANGE, DOUGH_TOO_WET, FINAL_MOISTURE_ABOVE_SPEC, NAOH_TOO_STRONG, COOLING_TOO_SHORT, OVEN_TEMP_HIGH, SULFUR_NIGHTS_EXCEEDED, SO2_TEST_REQUIRED, SPLIT_DELAY_EXCEEDED, DRYING_BEHIND_SCHEDULE, YIELD_BELOW_REFERENCE.
7. Produksi per shift: kapasitas tiap stasiun diubah ke satuan produk; output = minimum (stasiun pembatas). Stasiun batch (oven, tungku, greenhouse) dihitung dengan jam kalender per shift (24 ÷ shift per hari) karena berjalan terus.
8. Ceklis disimpan sebagai data (`checklists[]`, ditelusuri ke kode form KORA F-K/F-A/F-C), bukan hardcode komponen; isian ceklis disimpan di perangkat (offline) sampai modul R&D Lab (M5) tersedia.
9. Varian briket punya kode R&D dua huruf (BS shisha, BB BBQ, BC custom) sejalan dengan `rnd_product.code`; produk arang = AR. Penambahan baris `rnd_product` dilakukan di M5 setelah konfirmasi owner (draf `07-rnd/parameter_kora_draft.csv`).

## Konsekuensi
- (+) Semua angka formula dapat ditelusuri ke SOP KORA / literatur; GAP terlihat sebagai keyakinan C.
- (+) Kesalahan rumus dokumen tidak terbawa ke aplikasi; uji unit mengunci perilaku yang benar.
- (−) Tiga dataset (inventory → proses → formula) harus kompatibel versi; dicek di loader & test.
- (−) Laju stasiun kerja masih C dengan rentang lebar (K-06) — hasil shift bersifat perencanaan sampai time study KORA selesai.
