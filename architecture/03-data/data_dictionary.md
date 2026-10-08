---
doc: Data Dictionary
version: 1.0.0
date: 2026-10-08
related: [ERD.md, schema.sql, seed.sql]
---

# Kamus Data

## 1. Tabel

| Tabel | Deskripsi | Kunci & catatan |
|---|---|---|
| `dataset_version` | Versi dataset referensi (SemVer). Immutable setelah `PUBLISHED`. | Satu `is_active`; `parent_version_id` membentuk silsilah |
| `source` | Sumber riset per versi, grade A/B/C | `code` = S01..S24 |
| `commodity` | Komoditas: kelapa_jambul, arang_batok_belah2, kopra_asalan, kopra_edible | `unit_type` piece/bulk |
| `commodity_form` | Bentuk fisik/kemasan komoditas yang memengaruhi densitas | contoh: arang `halves_loose` vs `lumps` |
| `parameter` | Nilai fisik rentang `v_min ≤ v_typ ≤ v_max`, satuan SI | `key` tanpa sufiks satuan; `unit` di kolom tersendiri |
| `parameter_source` | Relasi N:M parameter ↔ sumber | |
| `container_type` | Dimensi dalam (m) & payload (kg). Custom = milik user | Custom wajib `owner_id` |
| `packaging_type` | Karung/kemasan: isi, berat bersih, dimensi terisi | `deformable` untuk karung lentur |
| `container_benchmark` | Angka muat dari pasar (butir/karung/ton) untuk kalibrasi | `conservative` = skenario pesimis |
| `benchmark_source` | Relasi N:M benchmark ↔ sumber | |
| `app_user` | Pengguna & peran (`viewer`, `editor`, `data_admin`) | |
| `warehouse` / `storage_zone` | Gudang & zona simpan (dimensi, tinggi tumpuk maks, utilisasi lantai) | `floor_util` default 0,65 |
| `scenario` | Satu perhitungan tersimpan: komoditas-form, target, mode, input | `share_slug` untuk tautan |
| `scenario_override` | Penggantian nilai parameter khusus skenario | Wajib form yang sama (IR-05) |
| `calc_result` | Hasil min/typ/max, `binding`, peringatan, `trace` | Ditulis hanya oleh server (IR-06) |
| `measurement` | Data sampling lapangan | `method`: timbang, jangka_sorong, meteran, ember_1m3, drum, moisture_meter, realisasi_stuffing |
| `calibration_proposal` | Usulan nilai baru dari sampling | APPROVED wajib n ≥ 10 + reviewer (IR-07) |
| `audit_log` | Jejak semua perubahan data referensi & proposal | Diisi trigger (IR-08) |

## 2. Satuan (`param_unit`)

| Kode | Arti | Konversi dari dataset JSON |
|---|---|---|
| `m` | meter | cm × 0,01 |
| `m3` | meter kubik | cm³ × 1e-6 |
| `kg` | kilogram | g × 0,001 |
| `kg_m3` | kg per m³ | langsung; stowage factor SF (m³/t) → 1000/SF |
| `fraction` | 0–1 | langsung |
| `pct` | persen | langsung |
| `count` | bilangan | langsung |

## 3. Katalog Parameter (dibangkitkan dari dataset v1.0.4)

> Dibangkitkan oleh `scripts/gen_data_dictionary.py` dengan aturan yang sama dengan `scripts/seed_from_dataset.py`. Nilai dalam satuan SI hasil konversi. Jangan edit manual.

### `kelapa_jambul` — Kelapa tua jambul (semi-husked)

| key | unit | min | typ | max | keyakinan |
|---|---|---|---|---|---|
| `geometry.body.length_polar` | m | 0.09 | 0.105 | 0.125 | C |
| `geometry.body.diameter_equatorial` | m | 0.085 | 0.095 | 0.115 | C |
| `geometry.tuft_extra_length` | m | 0.02 | 0.03 | 0.05 | C |
| `geometry.bounding_box.L` | m | 0.11 | 0.135 | 0.175 | C |
| `geometry.bounding_box.W` | m | 0.085 | 0.095 | 0.115 | C |
| `geometry.bounding_box.H` | m | 0.085 | 0.095 | 0.115 | C |
| `geometry.circumference` | m | 0.3 | 0.33 | 0.36 | C |
| `geometry.solid_volume` | m3 | 0.00035 | 0.0005 | 0.000865 | C |
| `mass_per_unit` | kg | 0.45 | 0.575 | 0.85 | B |
| `true_density` | kg_m3 | 930 | 998 | 1070 | A |
| `bulk_density[loose_pile]` | kg_m3 | 445 | 483 | 520 | A |
| `bulk_density[bagged_in_container]` | kg_m3 | 360 | 385 | 410 | C |
| `packing_fraction_random` | fraction | 0.45 | 0.48 | 0.55 | C |

### `arang_batok_belah2` — Arang batok kelapa belah 2 (utuh setengah tempurung)

| key | unit | min | typ | max | keyakinan |
|---|---|---|---|---|---|
| `geometry.raw_half_shell.rim_diameter` | m | 0.08 | 0.095 | 0.14 | C |
| `geometry.raw_half_shell.depth` | m | 0.04 | 0.05 | 0.065 | C |
| `geometry.raw_half_shell.wall_thickness` | m | 0.003 | 0.004 | 0.006 | C |
| `geometry.linear_shrinkage_on_carbonization` | fraction | 0.08 | 0.12 | 0.18 | C |
| `geometry.charcoal_half.rim_diameter` | m | 0.066 | 0.084 | 0.129 | C |
| `geometry.charcoal_half.depth` | m | 0.033 | 0.044 | 0.06 | C |
| `geometry.charcoal_half.wall_thickness` | m | 0.0025 | 0.0035 | 0.0055 | C |
| `geometry.nest_pitch` | m | 0.008 | 0.012 | 0.02 | C |
| `mass_per_unit.raw_half_shell` | kg | 0.06 | 0.085 | 0.12 | C |
| `mass_per_unit.charcoal_half` | kg | 0.015 | 0.025 | 0.042 | C |
| `charcoal_yield_mass_fraction` | fraction | 0.25 | 0.3 | 0.35 | C |
| `bulk_density[raw_halves_loose]` | kg_m3 | 150 | 195 | 240 | B |
| `bulk_density[charcoal_halves_loose]` | kg_m3 | 50 | 85 | 155 | C |
| `bulk_density[charcoal_halves_nested]` | kg_m3 | 85 | 145 | 270 | C |
| `bulk_density[charcoal_broken_lumps]` | kg_m3 | 400 | 475 | 550 | B |

### `kopra_asalan` — Kopra asalan (kopra asap/campur, mutu petani)

| key | unit | min | typ | max | keyakinan |
|---|---|---|---|---|---|
| `geometry.piece.length` | m | 0.04 | 0.08 | 0.14 | C |
| `geometry.piece.width` | m | 0.03 | 0.05 | 0.09 | C |
| `geometry.piece.thickness` | m | 0.008 | 0.011 | 0.016 | C |
| `mass_per_piece` | kg | 0.025 | 0.06 | 0.13 | C |
| `yield.nuts_per_kg_copra` | count | 3.5 | 4 | 5 | B |
| `yield.copra_per_nut` | kg | 0.2 | 0.25 | 0.285 | B |
| `moisture` | pct | 8 | 12 | 22 | A |
| `oil_content` | pct | 55 | 60 | 65 | C |
| `bulk_density[loose_bulk]` | kg_m3 | 440 | 500 | 545 | A |
| `bulk_density[bagged_jute]` | kg_m3 | 400 | 440 | 460 | A |

### `kopra_edible` — Kopra edible (kopra putih mangkok/cup)

| key | unit | min | typ | max | keyakinan |
|---|---|---|---|---|---|
| `geometry.piece.rim_diameter_or_length` | m | 0.04 | 0.08 | 0.1 | B |
| `geometry.piece.depth_or_width` | m | 0.025 | 0.04 | 0.06 | B |
| `geometry.piece.thickness` | m | 0.008 | 0.012 | 0.016 | B |
| `mass_per_piece` | kg | 0.015 | 0.08 | 0.18 | C |
| `moisture` | pct | 4 | 5 | 6 | A |
| `bulk_density[loose_cups]` | kg_m3 | 300 | 350 | 420 | C |
| `bulk_density[bagged_in_container]` | kg_m3 | 300 | 320 | 355 | B |
