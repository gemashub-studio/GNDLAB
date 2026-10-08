# Traceability Matrix

Kebutuhan → desain → implementasi acuan → bukti uji.

| Kebutuhan | Desain | Implementasi / artefak | Bukti uji | Status |
|---|---|---|---|---|
| FR-01 Katalog komoditas | ERD `COMMODITY`, `COMMODITY_FORM` | `seed.sql` | Seed termuat di PostgreSQL 16 | ✅ |
| FR-02 Katalog container | ERD `CONTAINER_TYPE` | dataset `containers[]` | Validator SCHEMA `container.*.volume` | ✅ |
| FR-03 Mode BULK/PIECE/PACKAGE | ADR-005, calc_spec §3 | golden_cases.json | 17 golden cases | ✅ spes. · ⏳ engine |
| FR-04 Batas pengikat | calc_spec §3.1 | golden `expect_binding` | `arang_..._40HC` = WEIGHT, lainnya VOLUME | ✅ spes. |
| FR-05 Kalkulator gudang | calc_spec §4 | golden `warehouse_floor_area` | 61,54 m² | ✅ spes. |
| FR-06 Konverter | calc_spec §5 | – | validator `jambul.circumference`, `asalan.copra_per_nut` | ✅ spes. |
| FR-07 Koreksi kadar air | calc_spec §5 | golden `moisture_correction` | 904,26 kg | ✅ spes. |
| FR-08 Mode rentang | ADR-003, calc_spec §2 | Validator RANGE | 0 pelanggaran min ≤ typ ≤ max | ✅ |
| FR-09 Simulator | ux_spec §3.3 | – | – | ⏳ M3 |
| FR-10 Skenario & ekspor | ERD `SCENARIO`, ARD §6 | `schema.sql` | IR-05, cek container wajib | ✅ skema |
| FR-11 Sampling & kalibrasi | ADR-002, ERD `MEASUREMENT`, `CALIBRATION_PROPOSAL` | `schema.sql` | IR-07 (3 uji) | ✅ skema |
| NFR-05 Traceability | ERD `PARAMETER_SOURCE`, `trace` | dataset `source_ids` | Validator SCHEMA source_id terdaftar | ✅ |
| NFR-06 Audit | ERD `AUDIT_LOG`, IR-08 | trigger `audit_row` | IR-08 (7 baris tercatat) | ✅ |
| NFR-07 Satuan SI | ADR-004 | `seed_from_dataset.py` | Pengaman fraksi & massa (ISS-005) | ✅ |
| Gaya visual gemasSTUDIO | `06-design/design_spec.md` | tokens.json, tailwind.preset.ts, globals.css, 4 mockup | Kontras 11/11 lulus WCAG AA | ✅ desain · ⏳ UI |
| RD-01..04 Batch, tahap, nilai parameter | `07-rnd/PRD_RnD.md`, `schema_rnd.sql` | trigger `rnd_check_measurement` | 21/21 uji `rnd_integrity_test.sql` | ✅ skema · ⏳ app |
| RD-05/06 Impor & versi parameter | PRD_RnD RFR-03, `def_version` | `parameter_template.csv` | – | ⏳ M5 (parameter menunggu owner) |
| Immutable dataset | ADR-002, IR-02 | trigger `forbid_published_mutation` | IR-02 (3 uji) | ✅ |

✅ = terspesifikasi & teruji di level data/skema · ⏳ = menunggu implementasi engine/UI oleh Claude Code
