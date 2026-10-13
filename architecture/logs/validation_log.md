# Validation Log — Dataset Komoditas Kelapa

> File ini **dibuat otomatis** oleh `scripts/validate_dataset.py`. Jangan diedit manual.

- Waktu run: 2026-10-13 17:04 WIB
- Dataset: `00-research\data\coconut_inventory_dataset.json` (versi 1.0.4)
- Toleransi uji silang: 10%
- Ringkasan: **105 PASS · 1 WARN · 0 FAIL · 2 INFO**
- Status akhir: **LULUS**

## 1. Skema & integritas

| Status | Check | Keterangan |
|---|---|---|
| PASS | `root.meta` | ada |
| PASS | `root.containers` | ada |
| PASS | `root.commodities` | ada |
| PASS | `root.sources` | ada |
| PASS | `source.S01` | url & grade valid |
| PASS | `source.S02` | url & grade valid |
| PASS | `source.S03` | url & grade valid |
| PASS | `source.S05` | url & grade valid |
| PASS | `source.S06` | url & grade valid |
| PASS | `source.S07` | url & grade valid |
| PASS | `source.S08` | url & grade valid |
| PASS | `source.S10` | url & grade valid |
| PASS | `source.S11` | url & grade valid |
| PASS | `source.S12` | url & grade valid |
| PASS | `source.S13` | url & grade valid |
| PASS | `source.S14` | url & grade valid |
| PASS | `source.S15` | url & grade valid |
| PASS | `source.S16` | url & grade valid |
| PASS | `source.S17` | url & grade valid |
| PASS | `source.S18` | url & grade valid |
| PASS | `source.S19` | url & grade valid |
| PASS | `source.S20` | url & grade valid |
| PASS | `source.S21` | url & grade valid |
| PASS | `source.S22` | url & grade valid |
| PASS | `source.S23` | url & grade valid |
| PASS | `source.S24` | url & grade valid |
| PASS | `container.20GP.volume` | L*W*H = 33.20 m3 vs tercatat 33.2 m3 |
| PASS | `container.40GP.volume` | L*W*H = 67.72 m3 vs tercatat 67.7 m3 |
| PASS | `container.40HC.volume` | L*W*H = 76.35 m3 vs tercatat 76.3 m3 |
| PASS | `commodity.kelapa_jambul.name_id` | ada |
| PASS | `commodity.kelapa_jambul.unit_type` | ada |
| PASS | `commodity.kelapa_jambul.geometry` | ada |
| PASS | `commodity.kelapa_jambul.bulk_density_kg_m3` | ada |
| PASS | `commodity.kelapa_jambul.packaging` | ada |
| PASS | `commodity.arang_batok_belah2.name_id` | ada |
| PASS | `commodity.arang_batok_belah2.unit_type` | ada |
| PASS | `commodity.arang_batok_belah2.geometry` | ada |
| PASS | `commodity.arang_batok_belah2.bulk_density_kg_m3` | ada |
| PASS | `commodity.arang_batok_belah2.packaging` | ada |
| PASS | `commodity.kopra_asalan.name_id` | ada |
| PASS | `commodity.kopra_asalan.unit_type` | ada |
| PASS | `commodity.kopra_asalan.geometry` | ada |
| PASS | `commodity.kopra_asalan.bulk_density_kg_m3` | ada |
| PASS | `commodity.kopra_asalan.packaging` | ada |
| PASS | `commodity.kopra_edible.name_id` | ada |
| PASS | `commodity.kopra_edible.unit_type` | ada |
| PASS | `commodity.kopra_edible.geometry` | ada |
| PASS | `commodity.kopra_edible.bulk_density_kg_m3` | ada |
| PASS | `commodity.kopra_edible.packaging` | ada |

## 2. Konsistensi rentang min/typ/max

| Status | Check | Keterangan |
|---|---|---|
| PASS | `all` | 50 objek range diperiksa |
| INFO | `confidence_profile` | 45 parameter unik: A=6 · B=9 · C=30 (C wajib diverifikasi lapangan) |

## 3. Uji silang rumus turunan

| Status | Check | Keterangan |
|---|---|---|
| PASS | `jambul.solid_volume.min` | (pi/6)L*D^2 = 340 cm3 vs tercatat 350 |
| PASS | `jambul.solid_volume.typ` | (pi/6)L*D^2 = 496 cm3 vs tercatat 500 |
| PASS | `jambul.solid_volume.max` | (pi/6)L*D^2 = 866 cm3 vs tercatat 865 |
| PASS | `jambul.bbox_L.min` | L_body + tuft = 11.0 cm vs tercatat 11.0 |
| PASS | `jambul.bbox_L.typ` | L_body + tuft = 13.5 cm vs tercatat 13.5 |
| PASS | `jambul.bbox_L.max` | L_body + tuft = 17.5 cm vs tercatat 17.5 |
| PASS | `jambul.mass_from_volume` | V*rho = 499 g vs massa typ 575 g (tol 15%; sisa sabut menambah massa) |
| PASS | `jambul.circumference` | pi*D = 29.8 cm, rentang 30-36 |
| PASS | `jambul.packing_fraction` | rho_bulk/rho_true = 0.484 vs tercatat 0.48 |
| PASS | `jambul.bag_mass` | 25 x 575 g = 14.38 kg vs tercatat 14.0 |
| PASS | `arang.rim_diameter.min` | raw*(1-shrink) = 6.56 cm vs tercatat 6.6 |
| PASS | `arang.rim_diameter.typ` | raw*(1-shrink) = 8.36 cm vs tercatat 8.4 |
| PASS | `arang.rim_diameter.max` | raw*(1-shrink) = 12.88 cm vs tercatat 12.9 |
| PASS | `arang.depth.min` | raw*(1-shrink) = 3.28 cm vs tercatat 3.3 |
| PASS | `arang.depth.typ` | raw*(1-shrink) = 4.40 cm vs tercatat 4.4 |
| PASS | `arang.depth.max` | raw*(1-shrink) = 5.98 cm vs tercatat 6.0 |
| PASS | `arang.wall_thickness.min` | raw*(1-shrink) = 0.25 cm vs tercatat 0.25 |
| PASS | `arang.wall_thickness.typ` | raw*(1-shrink) = 0.35 cm vs tercatat 0.35 |
| PASS | `arang.wall_thickness.max` | raw*(1-shrink) = 0.55 cm vs tercatat 0.55 |
| PASS | `arang.mass_charcoal.min` | m_raw*yield = 15.0 g vs tercatat 15 |
| PASS | `arang.mass_charcoal.typ` | m_raw*yield = 25.5 g vs tercatat 25 |
| PASS | `arang.mass_charcoal.max` | m_raw*yield = 42.0 g vs tercatat 42 |
| PASS | `arang.halves_loose_density.min` | rho_raw*yield/(1-s)^3 = 48 kg/m3 vs tercatat 50 |
| PASS | `arang.halves_loose_density.typ` | rho_raw*yield/(1-s)^3 = 86 kg/m3 vs tercatat 85 |
| PASS | `arang.halves_loose_density.max` | rho_raw*yield/(1-s)^3 = 152 kg/m3 vs tercatat 155 |
| PASS | `arang.bounding_box` | bbox {'L': 8.4, 'W': 8.4, 'H': 4.4} vs dimensi typ arang |
| PASS | `arang.density_order` | loose < nested < lump (logika fisik) |
| PASS | `asalan.copra_per_nut.min` | 1000/nuts_per_kg = 200 g vs tercatat 200 |
| PASS | `asalan.copra_per_nut.typ` | 1000/nuts_per_kg = 250 g vs tercatat 250 |
| PASS | `asalan.copra_per_nut.max` | 1000/nuts_per_kg = 286 g vs tercatat 285 |
| PASS | `asalan.stowage.min` | 1000/SF 2.27 = 441 kg/m3 vs tercatat 440 |
| PASS | `asalan.stowage.max` | 1000/SF 1.84 = 543 kg/m3 vs tercatat 545 |
| PASS | `edible.moisture_vs_standard` | edible max 6% <= 6% (SNI/APCC) dan asalan typ 12% lebih basah |

## 4. Uji vs benchmark container

| Status | Check | Keterangan |
|---|---|---|
| PASS | `jambul.20GP.22500` | hitung 22,230 butir (VOLUME-limited) vs benchmark 22,500-22,500 |
| PASS | `jambul.40GP.45000` | hitung 45,330 butir (VOLUME-limited) vs benchmark 45,000-47,500 |
| WARN | `jambul.20GP.10000` | hitung 22,230 butir (VOLUME-limited) vs benchmark 10,000-11,000 — skenario konservatif, selisih diharapkan |
| PASS | `arang.20GP.charcoal_broken_lumps` | hitung 12.6 t (VOLUME-limited, util 0.8) vs benchmark 12.0-13.0 t |
| PASS | `arang.40HC.charcoal_broken_lumps` | hitung 26.5 t (WEIGHT-limited, util 0.8) vs benchmark 26.0-26.0 t |
| PASS | `arang.20GP.raw_halves_loose` | hitung 6.5 t (VOLUME-limited, util 1.0) vs benchmark 5-8 t |
| PASS | `arang.40HC.raw_halves_loose` | hitung 14.9 t (VOLUME-limited, util 1.0) vs benchmark 10-16 t |
| PASS | `edible.20GP` | hitung 10.6 t (VOLUME-limited) vs benchmark 10-11 t |
| PASS | `edible.40HC` | hitung 24.4 t (VOLUME-limited) vs benchmark 24-27 t |
| INFO | `asalan.20GP` | prediksi 13.1 t (VOLUME-limited) — belum ada benchmark, perlu data lapangan |
| PASS | `jambul.bag_grid.20GP` | grid fit karung (49, 34, 21) cm = 924 karung vs benchmark 900-1000 |
| PASS | `jambul.bag_grid.40GP` | grid fit karung (49, 34, 21) cm = 1848 karung vs benchmark 1800-1950 |
| PASS | `pack.kelapa_jambul.PP_net_bag.fits_flat_bag` | kotak 35 L vs kapasitas kantong datar 50x80 cm = 46 L |
| PASS | `pack.arang_batok_belah2.PP_woven_bag.holds_content` | kotak 60 L vs isi 25 kg / rho[charcoal_broken_lumps] = 53 L |
| PASS | `pack.arang_batok_belah2.PP_woven_bag.fits_flat_bag` | kotak 60 L vs kapasitas kantong datar 56x90 cm = 66 L |
| PASS | `pack.arang_batok_belah2.PP_woven_bag.grid.20GP` | 495 karung x 25 kg = 12.4 t vs benchmark 12.0-13.0 t |
| PASS | `pack.arang_batok_belah2.PP_woven_bag.grid.40HC` | 1144 karung x 25 kg = 26.5 t vs benchmark 26.0-26.0 t |
| PASS | `pack.arang_batok_belah2.jumbo_bag.holds_content` | kotak 1173 L vs isi 550 kg / rho[charcoal_broken_lumps] = 1158 L |
| PASS | `pack.kopra_asalan.jute_or_PP_bag.holds_content` | kotak 131 L vs isi 50 kg / rho[bagged_jute] = 114 L |
| PASS | `pack.kopra_asalan.jute_or_PP_bag.fits_flat_bag` | kotak 131 L vs kapasitas kantong datar 70x110 cm = 124 L |
| PASS | `pack.kopra_edible.PP_or_jute_net_bag.holds_content` | kotak 75 L vs isi 25 kg / rho[loose_cups] = 71 L |
| PASS | `pack.kopra_edible.PP_or_jute_net_bag.fits_flat_bag` | kotak 75 L vs kapasitas kantong datar 60x100 cm = 85 L |
| PASS | `pack.kopra_edible.PP_or_jute_net_bag.grid.20GP` | 429 karung x 25 kg = 10.7 t vs benchmark 10-11 t |
| PASS | `pack.kopra_edible.PP_or_jute_net_bag.grid.40HC` | 975 karung x 25 kg = 24.4 t vs benchmark 24-27 t |
