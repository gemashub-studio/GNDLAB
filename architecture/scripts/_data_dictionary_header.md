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

