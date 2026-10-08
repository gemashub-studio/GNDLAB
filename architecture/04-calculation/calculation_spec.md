---
doc: Calculation Specification
title: Spesifikasi Engine Kalkulasi (calc-engine)
version: 1.0.0
date: 2026-10-08
related: [../02-architecture/adr/ADR-001-pure-calc-engine.md, ../02-architecture/adr/ADR-003-range-values.md, ../02-architecture/adr/ADR-005-loading-model.md, ../tests/fixtures/golden_cases.json]
---

# Spesifikasi Kalkulasi

Semua rumus memakai satuan SI (ADR-004). Simbol:

| Simbol | Arti | Satuan |
|---|---|---|
| `V_c` | volume dalam container = L·W·H | m³ |
| `P` | payload container | kg |
| `u` | utilisasi volume (ruang yang benar-benar terisi muatan) | 0–1 |
| `ρ` | densitas efektif sesuai form (`bulk_density`) | kg/m³ |
| `m` | massa per unit (butir/keping) | kg |
| `φ` | packing fraction acak = ρ_bulk / ρ_true | 0–1 |
| `w` | kadar air (basis basah) | 0–1 |
| `h_s` | tinggi tumpuk maksimum | m |
| `u_f` | utilisasi lantai gudang (sisa untuk lorong, ventilasi) | 0–1 |

## 1. Prinsip

1. **Fungsi murni.** Input → output, tanpa I/O.
2. **Setiap parameter adalah rentang** `{min, typ, max}` (ADR-003).
3. **Selalu laporkan batas pengikat**: `VOLUME`, `WEIGHT`, atau `NONE`.
4. **Selalu kembalikan `trace`**: nilai & sumber setiap parameter yang dipakai.

## 2. Aturan Kombinasi Rentang (Corner Evaluation)

Untuk fungsi `f(p₁ … p_k)` dengan k parameter tak pasti:

- `typ` = `f(p₁.typ, …, p_k.typ)`
- `min` / `max` = nilai minimum / maksimum dari `f` yang dievaluasi pada **seluruh 2^k kombinasi sudut** `{pᵢ.min, pᵢ.max}`.
- Batas: k ≤ 8 (≤ 256 evaluasi). Parameter yang di-override pengguna sebagai nilai tunggal dianggap pasti (min = typ = max).
- Alasan: fungsi di bawah monoton per parameter, sehingga ekstrem selalu ada di sudut; metode ini generik dan tidak perlu menurunkan arah tiap rumus secara manual.
- Mode opsional **Monte Carlo** (FR-12): distribusi segitiga (min, typ, max) per parameter, N = 5.000, seed tetap `20261008`; laporkan P10/P50/P90.

## 3. Mode Muat (ADR-005)

### 3.1 Mode A — Curah (BULK)
```
m_by_volume = V_c · u · ρ
m_load      = min(m_by_volume, P)
binding     = (m_by_volume > P) ? WEIGHT : VOLUME
```
Default `u`: curah dalam karung = 0,80 (arang lump), 0,90 (kopra karung goni), 1,00 bila `ρ` sudah merupakan densitas efektif-dalam-container (`bagged_in_container`).

### 3.2 Mode B — Per butir/keping (PIECE)
```
n_by_volume = V_c · u · ρ / m          (ρ = densitas curah form tsb)
n_by_weight = P / m
n_load      = floor(min(n_by_volume, n_by_weight))
```
Alternatif geometri murni (bila ρ belum terukur): `n = V_c · u · φ / V_unit`, dengan `V_unit = (π/6)·L·D²` untuk elipsoid.

### 3.3 Mode C — Grid kemasan (PACKAGE)
```
n_pack_geom = max over 6 orientasi (a,b,c) of  ⌊L/a⌋·⌊W/b⌋·⌊H/c⌋
n_pack_wt   = ⌊P / pack_net_kg⌋
n_pack      = min(n_pack_geom, n_pack_wt)
n_pieces    = n_pack · pcs_per_pack
```
Kemasan lentur (`deformable = true`): dimensi adalah **dimensi efektif terkalibrasi** (bukan ukuran karung kosong). Contoh jambul: 49×34×21 cm → 924 karung di 20GP (benchmark 900–1000).

### 3.4 Tumpukan bersarang (arang belah 2, `nestable`)
```
n_per_column = ⌊(h_avail − h_cup) / pitch⌋ + 1
columns      = ⌊L / d_rim⌋ · ⌊W / d_rim⌋           (grid persegi)
n_total      = n_per_column · columns
```
Golden: H 100 cm, h_cup 4,4 cm, pitch 1,2 cm → **80 keping/kolom**.

## 4. Kalkulator Gudang

```
V_need       = M / ρ                       (atau n · m / ρ)
A_footprint  = V_need / h_s
A_floor      = A_footprint / u_f           (luas zona termasuk lorong)
q_floor      = M / A_footprint             (beban lantai, kg/m²) → bandingkan floor_load
```
Untuk kemasan (Mode C):
```
packs_per_stack = ⌊h_s / pack_h⌋
stacks          = ⌈n_pack / packs_per_stack⌉
A_footprint     = stacks · pack_l · pack_w
```
Default `u_f` = 0,65; `h_s` dari dataset `storage` atau input zona. Gudang: tinggi efektif = `clear_height − 0,5 m` (ruang ventilasi/sprinkler).
Golden: 50 t, ρ 500, h_s 2,5 m, u_f 0,65 → **61,54 m²**.

## 5. Konversi

| Dari → Ke | Rumus |
|---|---|
| butir ↔ kg | `kg = n · m` |
| kg ↔ m³ | `m³ = kg / ρ` |
| karung ↔ butir | `n = karung · pcs_per_pack` |
| inch (spek dagang kelapa) → diameter | `D = (inch · 0,0254) / π` (spek dagang = **keliling**) |
| stowage factor ↔ densitas | `ρ = 1000 / SF` |
| butir kelapa → kopra | `kg_kopra = n_butir / nuts_per_kg_copra` |
| batok mentah → arang | `kg_arang = kg_batok · charcoal_yield_mass_fraction` |
| koreksi kadar air | `M₂ = M₁ · (1 − w₁) / (1 − w₂)` — golden: 1.000 kg @15% → 6% = **904,26 kg** |

## 6. Peringatan (warnings)

| Kode | Kondisi | Pesan (ID) |
|---|---|---|
| `LOW_CONFIDENCE_PARAM` | parameter dengan keyakinan C memengaruhi hasil | "Hasil memakai estimasi (C). Verifikasi dengan sampling." |
| `SELF_HEATING_RISK` | kopra & `w > 0,10` | "Kadar air > 10%: risiko pemanasan sendiri & jamur." |
| `FLAMMABLE` | arang | "Mudah terbakar; jauhkan dari api & kelembapan." |
| `ODOR_CONTAMINATION` | kopra_edible & kopra_asalan di zona sama | "Bau asap kopra asalan mencemari kopra edible." |
| `SHELF_LIFE` | kelapa_jambul | "Umur simpan ambien 30–45 hari." |
| `WEIGHT_LIMITED` | binding = WEIGHT | "Payload habis sebelum ruang penuh." |
| `ITEM_EXCEEDS_CONTAINER` | kemasan tidak muat di orientasi mana pun | "Kemasan lebih besar dari ruang." |
| `FLOOR_OVERLOAD` | `q_floor > floor_load` | "Beban lantai melebihi kapasitas." |
| `OVERRIDE_OUT_OF_RANGE` | override di luar `[min·0,5, max·2]` | ditolak (422) |
| `CONSERVATIVE_BENCHMARK_GAP` | hasil jauh di atas benchmark konservatif | "Satu sumber pasar melaporkan muat jauh lebih rendah." |

## 7. Kontrak Uji (Golden Cases)

File: `tests/fixtures/golden_cases.json` (dibangkitkan `scripts/validate_dataset.py`). Engine TS **wajib** lulus semua **17** kasus:

| Case | Mode | Hasil typ | Benchmark pasar |
|---|---|---|---|
| `jambul_20GP` | A→butir | 22.230 butir, VOLUME | 22.500 |
| `jambul_40GP` | A→butir | 45.330 butir, VOLUME | 45.000–47.500 |
| `arang_charcoal_broken_lumps_20GP` | A (u 0,8) | 12,62 t, VOLUME | 12–13 t |
| `arang_charcoal_broken_lumps_40HC` | A (u 0,8) | 26,50 t, WEIGHT | 26 t |
| `arang_raw_halves_loose_20GP` | A | 6,47 t, VOLUME | 5–8 t |
| `arang_raw_halves_loose_40HC` | A | 14,88 t, VOLUME | 10–16 t |
| `edible_20GP` | A | 10,62 t, VOLUME | 10–11 t |
| `edible_40HC` | A | 24,42 t, VOLUME | 24–27 t |
| `asalan_bagged_20GP` | A (u 0,9) | 13,15 t, VOLUME | *belum ada — perlu data lapangan* |
| `moisture_correction` | konversi | 904,26 kg | – |
| `nested_stack_count` | nested | 80 keping | – |
| `grid_fit_bags_20GP` | C | 924 karung jambul | 900–1000 |
| `grid_fit_arang_batok_belah2_bag_20GP` | C | 495 karung × 25 kg = 12,38 t, VOLUME | 12–13 t |
| `grid_fit_arang_batok_belah2_bag_40HC` | C | 1.144 karung geometri → 26,50 t, WEIGHT | 26 t |
| `grid_fit_kopra_edible_bag_20GP` | C | 429 karung × 25 kg = 10,72 t, VOLUME | 10–11 t |
| `grid_fit_kopra_edible_bag_40HC` | C | 975 karung × 25 kg = 24,38 t, VOLUME | 24–27 t |
| `warehouse_floor_area` | gudang | 61,54 m² | – |

Toleransi uji engine: angka eksak ±0,5% (pembulatan), kecuali dinyatakan lain.

## 8. Antarmuka TypeScript (acuan)

```ts
export type Range = { min: number; typ: number; max: number };
export type Confidence = 'A' | 'B' | 'C';
export type Param = Range & { key: string; unit: Unit; confidence: Confidence; sourceIds: string[] };
export type Binding = 'VOLUME' | 'WEIGHT' | 'NONE';

export interface ContainerInput {
  container: { L: number; W: number; H: number; payloadKg: number };
  form: { mode: 'BULK' | 'PIECE' | 'PACKAGE'; rho: Param; unitMass?: Param;
          pack?: { l: number; w: number; h: number; netKg: Param; pcs?: number } };
  volumeUtil?: Param;
}
export interface CalcOutput<T> {
  result: { min: T; typ: T; max: T };
  binding: Binding;
  warnings: { code: string; message: string }[];
  trace: Record<string, { value: Range; source: 'dataset' | 'override'; confidence: Confidence }>;
}
export function containerCapacity(i: ContainerInput): CalcOutput<{ massKg: number; pieces?: number; packs?: number }>;
export function warehouseSpace(i: WarehouseInput): CalcOutput<{ volumeM3: number; footprintM2: number; floorAreaM2: number; stacks?: number }>;
export function convert(i: ConvertInput): CalcOutput<{ value: number; unit: string }>;
export function correctMoisture(massKg: number, w1: number, w2: number): number;
export function nestedColumnCount(hAvailM: number, hCupM: number, pitchM: number): number;
export function bestGridFit(inner: Dim3, box: Dim3): { count: number; orientation: Dim3 };
```
