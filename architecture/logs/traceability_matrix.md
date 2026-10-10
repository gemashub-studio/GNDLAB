# Traceability Matrix

Kebutuhan → desain → implementasi acuan → bukti uji.

| Kebutuhan | Desain | Implementasi / artefak | Bukti uji | Status |
|---|---|---|---|---|
| FR-01 Katalog komoditas | ERD `COMMODITY`, `COMMODITY_FORM` | `seed.sql` | Seed termuat di PostgreSQL 16 | ✅ |
| FR-02 Katalog container | ERD `CONTAINER_TYPE` | dataset `containers[]` | Validator SCHEMA `container.*.volume` | ✅ |
| FR-03 Mode BULK/PIECE/PACKAGE | ADR-005, calc_spec §3 | packages/calc-engine/src/container.ts, grid.ts | golden.test.ts 17/17 (±0,5%) + container.test.ts 17 uji + paket dataset 28 uji (golden lewat dataset) | ✅ M1 |
| FR-04 Batas pengikat | calc_spec §3.1 | container.ts `binding` | golden `expect_binding` (arang lump & karung 40HC = WEIGHT) | ✅ M1 |
| FR-05 Kalkulator gudang | calc_spec §4 | packages/calc-engine/src/warehouse.ts | golden `warehouse_floor_area` 61,54 m² + 9 uji (kemasan, beban lantai, zona) | ✅ M1 |
| FR-06 Konverter | calc_spec §5 | packages/calc-engine/src/convert.ts, units.ts | misc.test.ts: butir↔kg↔t↔m³↔karung, inch keliling, stowage factor, butir→kopra, batok→arang | ✅ M1 |
| FR-07 Koreksi kadar air | calc_spec §5 | packages/calc-engine/src/moisture.ts | golden `moisture_correction` 904,26 kg + tolak w ≥ 1 / w < 0 | ✅ M1 |
| FR-08 Mode rentang | ADR-003, calc_spec §2 | packages/calc-engine/src/range.ts (evaluasi sudut 2^k, k ≤ 8) | range.test.ts 9 uji; override di luar [min·0,5, max·2] → OVERRIDE_OUT_OF_RANGE | ✅ M1 |
| Kode peringatan calc_spec §6 | calc_spec §6 | packages/calc-engine/src/warnings.ts | 10/10 kode terimplementasi & teruji | ✅ M1 |
| NFR-01 < 50 ms per skenario | ADR-001 | engine murni TS | container.test.ts (rata-rata 100 run) | ✅ M1 |
| NFR-02 Akurasi engine | calc_spec §7 | golden.test.ts membaca fixture langsung | 17/17 lulus; kasus tak dikenal = gagal | ✅ M1 |
| Loader dataset ↔ seed | ERD §3, ADR-004 | packages/dataset/src/loader.ts | 102 tuple parameter identik dengan seed.sql; profil keyakinan A6/B9/C30 | ✅ M1 |
| FR-09 Simulator | ux_spec §3.3, ADR-005 | calc-engine/layout.ts; apps/web /simulator (Plan2D SVG, Sim3D three.js InstancedMesh) | layout.test 11 uji (posisi = packs engine utk semua golden kemasan); E2E simulator 10 uji (angka simulator == kartu hasil 5 golden kemasan; 1.892 karung @ ±48 fps headless) | ✅ M3 |
| FR-10 Skenario & ekspor | ERD `SCENARIO`, ARD §6, ADR-006 | apps/web: /api/v1/scenarios, IndexedDB, /s/[slug], CSV/PDF | scenarios.db.test.ts 8 uji + E2E US-10 | ✅ M2 |
| FR-11 Sampling & kalibrasi | ADR-002, ADR-008, ERD `MEASUREMENT`, `CALIBRATION_PROPOSAL` | calc-engine/stats.ts; apps/web server/calibration.ts, approval.ts; API /measurements, /measurements/stats, /proposals; /sampling, /kalibrasi | IR-07 (3 uji); engine stats; sampling.test 6; calibration.db.test 11 (DB test: usulan n≥10, approval data_admin → patch, versi lama utuh, audit actor, skenario lama tetap) | ✅ M4 |
| US-08 Input sampling → usulan → approval | PRD §5, ux_spec §3.5 | SamplingWorkbench (form, impor CSV, prioritas ASM-06/01/02), ProposalReview | E2E e2e/calibration.spec.ts: CSV 10 sampel → usulan → setujui → versi baru aktif; skenario baru pakai nilai baru, skenario lama tidak berubah | ✅ M4 |
| Fase F — formula R&D (owner 2026-10-10) | ADR-009, `00-research/kora_research.md` | dataset formula v1.0.0; calc-engine formula-*.ts; dataset/formula.ts; /formula | engine formula+shift 32 uji (E1 gula, E2 titrasi, E5–E8), dataset formula 9 uji; E2E 6 uji (cuka, briket shisha/BBQ, kopra, arang) | ✅ F |
| Fase F — produksi per shift | ADR-009 §7 | calc-engine shift.ts (angkatan dalam jam kerja); lib/productionLines.ts; /produksi | engine shift (termasuk dalam 32); lini produksi 6 uji; E2E 2 uji (oven pembatas, briket wajib isi) | ✅ F |
| Fase F — ceklis R&D/QC/produk | ADR-009 §8, form KORA F-K/F-A/F-C | dataset `checklists[]` (19); lib/checklist.ts; IndexedDB gemas-ceklis; /ceklis | checklist 5 uji; E2E 2 uji (gagal/lolos/riwayat, filter); @mobile 4 halaman 360 px | ✅ F |
| RD-05 draf parameter dari KORA | PRD_RnD RFR-03, ADR-009 §9 | scripts/gen_rnd_param_draft.py → 07-rnd/parameter_kora_draft.csv (111) | validasi aturan rnd_param_def di skrip; cek sinkron di run_all_checks | 🟡 draf (tunggu owner) |
| PRD §8 Realisasi muat ≤ 10 % | ADR-008 §5 | lib/realization.ts; tab "Realisasi muat" | realization.test 5; E2E realisasi | ✅ M4 |
| NFR-05 Traceability | ERD `PARAMETER_SOURCE`, `trace` | dataset `source_ids` | Validator SCHEMA source_id terdaftar | ✅ |
| NFR-06 Audit | ERD `AUDIT_LOG`, IR-08 | trigger `audit_row` | IR-08 (7 baris tercatat) | ✅ |
| NFR-07 Satuan SI | ADR-004 | `seed_from_dataset.py` | Pengaman fraksi & massa (ISS-005) | ✅ |
| Gaya visual gemasSTUDIO | `06-design/design_spec.md` | tailwind.preset.ts & globals.css dipakai apa adanya (DEC-020) | Review visual vs mockup Main/Calculator/Mobile; E2E @mobile 360 px | ✅ M2 (dark mode ditunda DEC-021) |
| US-01..07, US-09..11 | PRD §5 | apps/web (Muat, Gudang, Konversi) | Playwright e2e/calculator.spec.ts 13/13 | ✅ M2 |
| FR-01/02 Katalog di UI & API | ARD §6 | /api/v1/commodities, /containers, /datasets/active, halaman Data & Sumber | E2E API + smoke test | ✅ M2 |
| NFR-03 Offline-first | ARD AR-07, DEC-024 | Serwist sw.ts + IndexedDB | SW + cache halaman terbukti (log SW); kalkulator di halaman terbuka jalan offline; navigasi offline belum stabil di emulasi (ISS-025) | 🟡 M2 sebagian |
| NFR-04 Mobile 360 px | ux_spec §1 | Shell menu bawah, target ≥ 44 px | E2E @mobile | ✅ M2 |
| Skema DB via Prisma | ERD, schema.sql | migrasi 0001 = schema.sql apa adanya + 0002_auth | schema_integrity_test 18/18 pada DB hasil migrasi; lib.test byte-equal | ✅ M2 |
| Fase P — alur proses (owner 2026-10-09) | ADR-007, `00-research/process_research.md` | dataset proses v1.0.0, calc-engine/process.ts, dataset/process.ts, /proses | engine 11 uji proses, dataset 11 uji (cek silang kopra/butir), E2E 5 uji alur proses | ✅ P |
| Simulasi kelapa lingkaran + ukuran ft | DEC-028, DEC-029, ADR-005 | ContainerCircleSim, lib/imperial.ts | E2E load-sim (ft, lingkaran), lib.test imperial | ✅ P |
| RD-01..04 Batch, tahap, nilai parameter | `07-rnd/PRD_RnD.md`, `schema_rnd.sql` | trigger `rnd_check_measurement` | 21/21 uji `rnd_integrity_test.sql` | ✅ skema · ⏳ app |
| RD-05/06 Impor & versi parameter | PRD_RnD RFR-03, `def_version` | `parameter_template.csv` | – | ⏳ M5 (parameter menunggu owner) |
| Immutable dataset | ADR-002, IR-02 | trigger `forbid_published_mutation` | IR-02 (3 uji) | ✅ |

✅ = terspesifikasi & teruji di level data/skema · ⏳ = menunggu implementasi engine/UI oleh Claude Code
