# Prompt untuk Claude Code

Pakai berurutan. Tempel **Prompt Kickoff** sekali di awal, lalu prompt per fase (M1 → M5). Setelah tiap fase, review hasilnya sebelum menempel prompt berikutnya.

Prasyarat: repo baru dengan folder `architecture/` di root. Node.js 20+, pnpm, dan PostgreSQL 16 (lokal atau Docker).

---

## 0. Prompt Kickoff

```
Kamu akan membangun aplikasi "gemasSTUDIO — Coco Inventory & R&D Lab" — kalkulator dimensi
dan simulator ruang inventory (gudang + container) untuk 4 komoditas kelapa: kelapa tua jambul,
arang batok belah 2, kopra asalan, dan kopra edible.

Seluruh riset, data, dan desain SUDAH SELESAI dan tervalidasi di folder architecture/.
Jangan riset ulang dan jangan mengarang angka.

Langkah pertama — baca dulu, jangan menulis kode:
1. architecture/HANDOFF.md
2. architecture/CLAUDE.md (aturan kerja wajib — ikuti selama proyek)
3. architecture/01-product/PRD.md
4. architecture/02-architecture/ARD.md dan semua file di architecture/02-architecture/adr/
5. architecture/04-calculation/calculation_spec.md
6. architecture/03-data/ERD.md dan architecture/03-data/schema.sql
7. architecture/05-ui-ux/ux_spec.md
8. architecture/06-design/design_spec.md, tokens.json, tailwind.preset.ts, globals.css
   dan mockup di architecture/06-design/mockups/ (gaya "Punk Skate Lab" — WAJIB diikuti)
9. architecture/07-rnd/PRD_RnD.md dan architecture/07-rnd/schema_rnd.sql (modul R&D Lab)
10. architecture/tests/fixtures/golden_cases.json

Lalu jalankan: bash architecture/scripts/run_all_checks.sh
(pastikan output "SEMUA CEK LULUS").

Setelah itu, balas dengan:
- ringkasan pemahamanmu dalam maksimal 10 poin,
- rencana implementasi M1–M5 (struktur monorepo, paket, urutan file),
- daftar pertanyaan HANYA untuk hal yang benar-benar ambigu
  (lihat HANDOFF.md §6 untuk default yang boleh dipakai).

Jangan mulai menulis kode sampai aku menyetujui rencananya.
```

---

## 1. Prompt Fase M1 — Engine Kalkulasi

```
Rencana disetujui. Kerjakan Fase M1: engine kalkulasi.

Scope:
- Scaffold monorepo pnpm + Turborepo sesuai ARD §5:
  apps/web (kosong dulu), packages/calc-engine, packages/dataset.
- packages/dataset:
  - salin architecture/00-research/data/coconut_inventory_dataset.json saat build
    (jangan edit manual),
  - skema Zod untuk seluruh dataset,
  - loader yang mengonversi cm→m, g→kg, cm³→m³ (ADR-004),
    dengan branded types Meters/Kg/M3/KgPerM3.
- packages/calc-engine (TypeScript murni, tanpa I/O, tanpa dependency runtime):
  range.ts (evaluasi sudut 2^k, k ≤ 8), units.ts, grid.ts (bestGridFit 6 orientasi),
  container.ts (mode BULK / PIECE / PACKAGE + binding), warehouse.ts, moisture.ts,
  nesting.ts, convert.ts, warnings.ts (semua kode di calculation_spec §6), trace.
  Ikuti signature di calculation_spec §8.
- Test (Vitest):
  - golden.test.ts yang MEMBACA architecture/tests/fixtures/golden_cases.json —
    17/17 kasus harus lulus (toleransi ±0,5%),
  - unit test per modul, termasuk kasus tepi:
    override di luar rentang → error, kemasan lebih besar dari container → hasil 0 + warning.

Aturan:
- Jika sebuah golden case gagal, perbaiki ENGINE, bukan file golden.
  Kalau kamu yakin golden-nya salah, berhenti dan jelaskan ke aku dengan perhitungannya.
- Setelah selesai: perbarui architecture/logs/traceability_matrix.md (FR-03..FR-08 → ✅
  dengan bukti), catat temuan di risk_issue_log.md, lalu jalankan
  bash architecture/scripts/run_all_checks.sh.

Laporan akhir fase: output pnpm test, daftar file yang dibuat, dan isu yang ditemukan.
```

---

## 2. Prompt Fase M2 — Aplikasi Web & Kalkulator

```
Lanjut Fase M2: aplikasi web Next.js 15 (App Router) + Tailwind di apps/web.
Nama aplikasi: gemasSTUDIO.

Gaya visual (WAJIB):
- Pakai architecture/06-design/tailwind.preset.ts sebagai preset Tailwind dan
  architecture/06-design/globals.css sebagai CSS global. Jangan menambah warna di luar token.
- Terjemahkan mockup architecture/06-design/mockups/Main.dc.html, Calculator.dc.html
  dan Mobile.dc.html ke komponen React — ikuti tata letak, hierarki, dan gaya
  (tanpa radius, garis 3px, bayangan keras, Bowlby One / Archivo / JetBrains Mono).
  Angka stok di mockup adalah data contoh; angka sungguhan dari engine & database.

Scope:
- Database: Prisma yang setara 1:1 dengan architecture/03-data/schema.sql.
  CHECK constraint & trigger (IR-01..IR-08) masuk lewat migrasi SQL mentah.
  Seed memakai architecture/03-data/seed.sql.
  Jalankan architecture/tests/schema_integrity_test.sql terhadap DB hasil migrasi —
  18/18 harus PASS.
- API REST /api/v1 sesuai ARD §6. Server SELALU menghitung ulang dengan calc-engine
  sebelum menyimpan. Validasi input dengan Zod; error sesuai ARD §9.
- Halaman (ikuti ux_spec §2–§4):
  Beranda (pilih komoditas), Kalkulator Container, Kalkulator Gudang, Konverter,
  Data & Sumber, Skenario tersimpan (bagikan via share_slug, ekspor CSV & PDF).
- Kartu hasil wajib menampilkan: angka typ besar, pita min–max, badge keyakinan A/B/C
  (dengan huruf, bukan warna saja), label batas pengikat VOLUME/BERAT, bar isi volume %
  & berat %, pembanding benchmark pasar, dan peringatan.
- PWA offline: dataset + engine di-cache; skenario offline disimpan di IndexedDB.
- Auth (NextAuth email) HANYA untuk simpan skenario & kalibrasi;
  kalkulator tetap bisa dipakai tanpa login.
- Mobile-first 360 px, target sentuh ≥ 44 px, dark mode, kontras WCAG AA.

Test: Playwright E2E untuk US-01..US-07 dan US-09..US-11 di PRD
(nilai yang diharapkan ada di kolom Acceptance Criteria).

Akhiri fase seperti M1: perbarui traceability_matrix.md & logs, jalankan run_all_checks.sh,
laporkan hasilnya.
```

---

## 3. Prompt Fase M3 — Simulator 2D & 3D

```
Lanjut Fase M3: simulator ruang (ux_spec §3.3, ADR-005).

Scope:
- 2D denah (SVG): tampak atas container atau zona gudang; grid tumpukan karung dari
  bestGridFit / warehouseSpace; lorong diarsir; hover menampilkan isi tumpukan.
- 3D isometrik (three.js via @react-three/fiber): container/zona sebagai kotak transparan,
  karung sebagai balok dengan dimensi terisi dari dataset; slider "isi %" untuk
  animasi stuffing; kontrol orbit; performa ≥ 30 fps untuk 1.200 karung (gunakan InstancedMesh).
- Arang belah 2 utuh: tampilkan kolom tumpukan bersarang (nestedColumnCount).
- Label tetap di layar: "Visual adalah representasi grid, bukan posisi fisik eksak".
- Angka di simulator HARUS identik dengan kartu hasil kalkulator untuk input yang sama —
  buat test yang membandingkan keduanya untuk semua golden case kemasan.

Akhiri fase dengan update traceability (FR-09), logs, dan run_all_checks.sh.
```

---

## 4. Prompt Fase M4 — Sampling Lapangan & Kalibrasi

```
Lanjut Fase M4: data lapangan & kalibrasi (PRD US-08, ADR-002, ERD MEASUREMENT /
CALIBRATION_PROPOSAL / AUDIT_LOG).

Scope:
- Form input sampling (ux_spec §3.5) + impor CSV dengan format persis
  architecture/logs/field_sampling_template.csv.
- Statistik per parameter (n, mean, min, max, SD). Bila n ≥ 10, buat
  CALIBRATION_PROPOSAL otomatis (min = P5, typ = median, max = P95).
- Halaman review untuk role data_admin: setujui / tolak.
  Persetujuan membuat dataset_version baru (naik patch SemVer), status PUBLISHED,
  dan versi lama tetap utuh (IR-02).
- Skenario lama tetap menghitung dengan versi datasetnya sendiri (reproducible).
- Laporan "Realisasi stuffing": input jumlah karung/butir & berat aktual per container,
  tampilkan selisih vs prediksi (metrik PRD §8: target ≤ 10%).
- Prioritaskan di UI parameter dengan risiko tertinggi: ASM-01, ASM-02, ASM-06
  (lihat architecture/logs/assumption_register.md).

Test: E2E alur penuh sampling → proposal → approval → versi baru → skenario baru memakai
nilai baru, skenario lama tidak berubah.

Akhiri dengan update semua logs, traceability matrix (semua baris ✅),
run_all_checks.sh, dan ringkasan rilis v1.
```

---

## 5. Prompt Fase M5 — R&D Lab (Pencatatan Batch Produk Turunan)

```
Lanjut Fase M5: modul R&D Lab untuk produk turunan kelapa — Kopra Edible (KE),
Kopra Asalan (KA), Bioleather (BL), Cuka Kelapa (CK).
Spesifikasi: architecture/07-rnd/PRD_RnD.md (RD-01..RD-10, RFR-01..07).
Mockup: architecture/06-design/mockups/RnD.dc.html.

Scope:
- Database: terapkan architecture/07-rnd/schema_rnd.sql apa adanya (migrasi SQL mentah
  setelah schema inventory). Jalankan architecture/tests/rnd_integrity_test.sql —
  semua PASS.
- PARAMETER ADALAH DATA. Form input dibangkitkan dari rnd_param_def aktif
  (number → input angka + satuan + indikator target; text → textarea;
  choice → pilihan; boolean → toggle). Jangan pernah menulis parameter produk
  sebagai kolom tabel atau field statis.
- Impor parameter dari CSV dengan format persis architecture/07-rnd/parameter_template.csv:
  preview, validasi per baris (alasan penolakan jelas), lalu simpan.
  Perubahan definisi = def_version baru.
- Halaman: tab 4 produk → alur tahap → log batch → form "Catat batch" (panel gelap) →
  detail batch (nilai per tahap, foto, observasi, out-of-spec ditandai oranye) →
  perbandingan lintas batch + ekspor CSV.
- Kode batch otomatis XX-YYMM-NNN, aman dari balapan (sequence per produk-bulan).
- Offline-first untuk pencatatan di lab (IndexedDB + sinkron).

Test: E2E RD-01..RD-10. Uji impor CSV dengan baris valid & tidak valid.

Catatan: jika parameter produk dari owner BELUM ada di repo, bangun semua fitur
dengan parameter uji saja, lalu tampilkan empty-state "Parameter menyusul" di UI.
Akhiri seperti fase lain: traceability, logs, run_all_checks.sh.
```

---

## Prompt Cadangan

**Saat parameter R&D dari owner sudah siap (CSV terisi):**
```
Parameter R&D sudah ada di architecture/07-rnd/parameter_template.csv (sudah diisi).
Validasi file itu terhadap aturan rnd_param_def, laporkan baris yang bermasalah,
lalu impor lewat fitur impor aplikasi (bukan SQL manual) dan tunjukkan form batch
untuk tiap produk.
```


**Jika Claude Code mulai menebak angka atau meriset ulang:**
```
Stop. Semua angka harus berasal dari architecture/00-research/data/coconut_inventory_dataset.json
melalui packages/dataset. Tunjukkan dari mana angka itu kamu ambil, lalu perbaiki.
```

**Jika golden case gagal dan ia ingin mengubah file golden:**
```
Jangan ubah golden_cases.json. Tunjukkan perhitungan manual untuk kasus itu langkah demi langkah
menurut calculation_spec.md, lalu bandingkan dengan output engine.
```

**Untuk memperbarui data setelah sampling lapangan di luar aplikasi:**
```
Perbarui architecture/00-research/data/coconut_inventory_dataset.json dengan data berikut: [tempel data].
Naikkan meta.version (patch), catat di logs/CHANGELOG.md, perbarui assumption_register.md
(status asumsi terkait), lalu jalankan run_all_checks.sh dan laporkan perubahan golden cases.
```
