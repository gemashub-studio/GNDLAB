# ADR-005: Model muat = densitas efektif + grid kemasan (bukan bin-packing 3D bebas)

- **Status:** Accepted
- **Tanggal:** 2026-10-08
- **Terkait:** AR-05, FR-03, FR-04

## Konteks
Butir kelapa, keping arang, dan potongan kopra berbentuk tidak beraturan dan dimuat dalam karung lentur. Bin-packing 3D presisi untuk benda tak beraturan mahal dan tidak lebih akurat daripada data empiris.

## Keputusan
Tiga mode, dipilih otomatis per komoditas/bentuk (bisa diganti pengguna):
| Mode | Kapan | Rumus inti |
|---|---|---|
| **A. Curah (densitas)** | kopra curah, arang lump | m = V × u × ρ_bulk |
| **B. Per-butir** | kelapa jambul tanpa karung, arang belah 2 | n = V × u × φ / V_unit |
| **C. Grid kemasan** | karung/kotak | n_kemasan = max orientasi Π floor(Dim_container / Dim_kemasan) |

Hasil akhir selalu `min(batas_volume, batas_berat)` dengan label `binding`.

## Validasi
Mode A & C sudah dicek terhadap benchmark dagang (lihat `logs/validation_log.md`): jambul 20GP 22.230 vs 22.500 butir; grid karung 924 vs 900–1000; arang lump 12,6 t vs 12–13 t; kopra edible 10,6 t vs 10–11 t.

## Konsekuensi
- (+) Cepat, dapat dijelaskan, terkalibrasi empiris.
- (−) Visual 3D adalah representasi grid, bukan posisi fisik eksak — UI menyatakannya.
