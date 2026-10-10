# ADR-010: Dataset & kalkulator rantai produksi (Fase G)

- **Status:** Accepted
- **Tanggal:** 2026-10-10
- **Terkait:** permintaan owner 2026-10-10 (Fase G); ADR-003, ADR-005, ADR-007, ADR-009; `00-research/chain_research.md`

## Konteks
Owner meminta kalkulator untuk SETIAP tahap rantai: angkut kelapa jambul (truk & container berbagai ukuran), penerimaan & simpan per lot asal (DR ≤500 / DT >500 mdpl), kupas–belah–sortir–air kelapa, pengeringan (desainer greenhouse, jemur, oven), congkel/QC/grade & kemasan, arang per asal (drum pirolisis / kolam, 2× ayak rotari, hammer mill), briket (campuran DT:DR), cuka, dan bioleather + selulosa tambahan (cocopeat/cocofiber/lainnya).

## Keputusan
1. Data baru disimpan di `00-research/data/coconut_chain_dataset.json` v1.0.0 (format sama dengan dataset formula, sumber C01–C20). Angka yang sudah ada di dataset inventory/proses/formula **dirujuk** lewat field `*_ref`, tidak disalin. Dataset rantai mengunci versi formula (`requires_formula_dataset`) dan inventory (`requires_inventory_dataset`).
2. Dataset inventory v1.0.4 **tidak diubah** (golden 17/17 tetap kontrak). Container 45HC dan truk masuk dataset rantai; loader menggabungkan container inventory + kendaraan rantai menjadi satu daftar kendaraan.
3. Kelas asal lot ditetapkan owner: **DR ≤500 mdpl, DT >500 mdpl** (menutup ISS-037/K-03). Kode lot `{KELAS}-{YYMMDD}-{NNN}`.
4. Kalkulator desain (greenhouse, kolam, tray) memakai **ukuran milik pengguna sebagai input** + parameter bersumber; rumus = geometri murni. Skala kipas & titik bakar belerang untuk ruang ≠105 m³ = skala linear dari contoh KORA, ditandai turunan (C).
5. Pengaruh ketinggian kebun terhadap mutu batok = GAP; kalkulator campuran briket DT:DR memakai **hasil lab per lot** (rata-rata tertimbang) dan bisa menghitung rasio maksimum yang masih memenuhi batas spesifikasi.
6. Kapasitas angkut kendaraan = min(batas volume grid karung/curah, payload typ). Payload truk = data vendor (C) dan wajib dicek ke JBI di buku KIR.
7. Satuan engine ditambah `deg` (derajat kemiringan rak/tray).
