# CHANGELOG

Format: [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) · Versi dataset mengikuti SemVer (ADR-002).
Waktu dalam WIB (UTC+7).

## [arsitektur 1.1.0] — 2026-10-08
### Ditambahkan
- Nama aplikasi resmi **gemasSTUDIO** (keputusan owner).
- `06-design/`: bahasa visual "Punk Skate Lab" — `tokens.json`, `tailwind.preset.ts`, `globals.css`, `design_spec.md`, 4 mockup (`Main`, `Calculator`, `RnD`, `Mobile`). Kontras 11/11 pasangan warna lulus WCAG AA (terendah 6,06:1).
- `07-rnd/`: modul R&D Lab — `PRD_RnD.md` (RD-01..10), `schema_rnd.sql` (parameter sebagai data), `parameter_template.csv` untuk diisi owner.
- `tests/rnd_integrity_test.sql`: 21 uji (RI-01..RI-04, CHECK, view, audit). `run_all_checks.sh` kini menguji DB R&D.
- `CLAUDE_CODE_PROMPT.md`: langkah gaya visual di M2 + Fase **M5 R&D Lab** + prompt impor parameter.
### Diperbaiki selama validasi
- `rnd_param_def`: parameter tipe `choice` tanpa daftar pilihan sempat lolos karena CHECK bernilai NULL dianggap lulus di PostgreSQL (ISS-012).

## [dataset 1.0.4] — 2026-10-08
### Ditambahkan
- Dimensi karung **terisi** & ukuran karung **datar** untuk semua kemasan yang sebelumnya kosong (ISS-011):
  - Arang 25 kg PP woven: datar 56×90 → terisi **64×45×21 cm** (495 karung/20GP ≈ 12,4 t; 40HC dibatasi berat 26,5 t).
  - Arang jumbo bag 550 kg: **95×95×130 cm** (jumbo standar 90×90×100 cm hanya memuat ~385 kg arang lump).
  - Kopra asalan 50 kg: datar 70×110 → terisi **88×55×27 cm** (belum ada benchmark container).
  - Kopra edible 25 kg: datar 60×100 → terisi **79×53×18 cm** (429 karung/20GP ≈ 10,7 t; 975/40HC ≈ 24,4 t).
  - Kelapa jambul: ukuran datar karung jaring 50×80 cm.
- Field `density_ref` per kemasan (densitas acuan untuk uji isi karung).
- Sumber S23 (ukuran karung goni) & S24 (jumbo bag FIBC).
- Validator: uji kemasan `holds_content`, `fits_flat_bag` (rumus kantong bantal), `grid` vs benchmark ton. Golden cases 13 → **17**.

## [dataset 1.0.3] — 2026-10-08
### Diperbaiki
- `arang_batok_belah2.bulk_density.charcoal_halves_loose`: 110/150/200 → **50/85/155 kg/m³**. Estimasi lama tidak konsisten dengan fisika karbonisasi: ρ = ρ_batok_mentah × yield ÷ (1 − susut)³ = 195 × 0,30 ÷ 0,88³ ≈ 86 kg/m³ (ISS-010). Ditambah field `derivation` dan uji silang validator.
- `…charcoal_halves_nested`: 200/260/320 → **85/145/270 kg/m³** (rasio bersarang/lepas 1,7× dipertahankan).

## [dataset 1.0.2] — 2026-10-08
### Diperbaiki
- `kelapa_jambul.packaging[0].bag_dims_cm_filled`: 70×45×30 → **49×34×21 cm**. Uji grid fit lama menghasilkan 285 karung/20GP vs benchmark 900–1000 (ISS-003). Nilai baru diturunkan balik dari benchmark → 924 karung.

## [dataset 1.0.1] — 2026-10-08
### Diperbaiki
- `arang_batok_belah2.mass_per_unit_g.charcoal_half.max`: 35 → **42 g** (= 120 g × yield 0,35). Ditemukan validator (ISS-001).
- `arang_batok_belah2.geometry.charcoal_half_cm.*`: min/max dihitung ulang tepat dari rumus `raw × (1 − shrinkage)` dengan pasangan ekstrem yang benar (min memakai susut maks, max memakai susut min): rim 6,6/8,4/12,9; depth 3,3/4,4/6,0; wall 0,25/0,35/0,55 cm.
- `kelapa_jambul.geometry.solid_volume_cm3.max`: 800 → **865** (= π/6 × 12,5 × 11,5²).

## [dataset 1.0.0] — 2026-10-08
### Ditambahkan
- Dataset awal 4 komoditas, 3 container, 20 sumber, hasil riset web (lihat `research_log.md`).

## [arsitektur 1.0.0] — 2026-10-08
### Ditambahkan
- PRD, ARD, ADR-001..005, ERD, `schema.sql`, `seed.sql`, kamus data, spesifikasi kalkulasi, spesifikasi UX.
- `scripts/validate_dataset.py`, `scripts/seed_from_dataset.py`, `scripts/run_all_checks.sh`.
- `tests/schema_integrity_test.sql` (18 uji IR-01..IR-08), `tests/fixtures/golden_cases.json` (13 kasus).
### Diperbaiki selama validasi
- Validator: deteksi bentuk arang memakai `startswith("arang")` — sebelumnya teks "batok mentah belah (bukan arang)" ikut terbaca sebagai arang (ISS-002).
- Seed: form kelapa jambul dipecah `loose` & `bagged` agar densitas dalam-karung (385) tersedia untuk kalkulasi container (ISS-004).
- Seed: urutan pemetaan satuan — `charcoal_yield_mass_fraction` sempat terpetakan sebagai kg 0,0003 alih-alih fraksi 0,30 (ISS-005); ditambah pengaman fraksi ≤ 1 & massa per unit ≤ 50 kg.
- Seed: sufiks satuan dibuang dari key parameter (`mass_per_unit_g` → `mass_per_unit`, satuan di kolom `unit`) (ISS-006).
- Skema: trigger `forbid_published_mutation` & `audit_row` ditulis ulang dengan percabangan `TG_OP`/`TG_TABLE_NAME` eksplisit (akses field `NEW` pada tabel/operasi yang salah akan error saat runtime) (ISS-007).
- PRD: baseline metrik keyakinan C dikoreksi dari "22" (perkiraan) menjadi **30 dari 45** (dihitung otomatis) (ISS-008).
