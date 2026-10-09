# Rencana Implementasi M1–M5

Sumber: `architecture/CLAUDE_CODE_PROMPT.md`, PRD §9, ARD §5. Status diperbarui tiap akhir fase.

## Struktur monorepo

```
gemasSTUDIO/
├─ apps/web/                 # M2 — Next.js 15 App Router (UI + /api/v1), Prisma, PWA
├─ packages/calc-engine/     # M1 ✅ — TS murni, zero dependency, SI, golden test
├─ packages/dataset/         # M1 ✅ — salinan JSON (build) + Zod + loader SI (paritas seed)
├─ packages/ui/ (opsional)   # M2 — komponen Punk Skate Lab bila dipakai >1 app
├─ architecture/             # spesifikasi (sumber kebenaran desain & data)
└─ brain/                    # otak kedua lintas agent
```
Dependensi: `web → dataset → calc-engine`. Engine tidak bergantung pada apa pun.

## Status

| Fase | Isi | Status | Bukti |
|---|---|---|---|
| M0 | Data, validator, skema | ✅ (handoff) | run_all_checks: 105 PASS |
| M1 | Engine + dataset loader | ✅ 2026-10-08 | 99/99 test (17/17 golden), tsc bersih |
| M2 | Web, DB, API, kalkulator, PWA | ✅ 2026-10-09 (offline nav: ISS-025 terbuka) | 131 unit + 13 E2E, run_all_checks LULUS |
| M3 | Simulator 2D SVG + 3D r3f | ⏳ | – |
| M4 | Sampling, kalibrasi, approval | ⏳ | – |
| M5 | R&D Lab | ⏳ (parameter owner menyusul) | – |

## M2 — rencana rinci (belum dikerjakan)
1. `apps/web`: Next.js 15 + Tailwind memakai `architecture/06-design/tailwind.preset.ts` & `globals.css` (font Bowlby One/Archivo/JetBrains Mono via `next/font`).
2. Prisma: introspeksi/terjemah 1:1 `schema.sql`; trigger & CHECK lewat migrasi SQL mentah. Seed dari `seed.sql`. Uji `schema_integrity_test.sql` 18/18.
3. API `/api/v1` (ARD §6) — Zod input, server selalu re-calculate pakai `buildContainerInput` + `containerCapacity`; error map: `OverrideOutOfRangeError`/`InvalidMoistureError` → 422, versi tak dikenal → 404.
4. Halaman: Beranda, Kalkulator Container, Gudang, Konverter, Data & Sumber, Skenario (share_slug, CSV, PDF `@react-pdf/renderer`).
5. Komponen kartu hasil: typ besar, pita min–max, badge A/B/C berhuruf, label VOLUME/BERAT, bar `volumeFill`/`weightFill`, benchmark, warnings.
6. PWA: Serwist (lihat benchmark.md) — cache dataset + engine; IndexedDB (`idb`) untuk skenario offline, sinkron idempoten.
7. Auth.js (email magic link) hanya untuk simpan skenario & kalibrasi.
8. Playwright: US-01..07, US-09..11. Mobile 360 px.
**Butuh dari owner sebelum M2 DB:** password postgres lokal (lihat environment.md).

## M3–M5 ringkas
- **M3:** `bestGridFit().grid {nx,ny,nz}` & `orientation` sudah tersedia untuk simulator; `nestedCapacity()` untuk kolom arang bersarang. InstancedMesh untuk ≥1.200 karung. Test: angka simulator == kartu hasil untuk semua golden kemasan.
- **M4:** statistik n/mean/min/max/SD; n ≥ 10 → proposal (P5/median/P95); approval `data_admin` → versi patch baru; skenario lama tetap pakai versinya.
- **M5:** `schema_rnd.sql` apa adanya; form dibangkitkan dari `rnd_param_def`; impor CSV dengan preview & alasan penolakan per baris; kode batch `XX-YYMM-NNN` lewat sequence; offline-first.

## Fase P — Alur Proses Kelapa (permintaan owner 2026-10-09, dikerjakan otonom)

Permintaan: bahasa UI lebih santai; simulasi kelapa digambar lingkaran; ukuran container dalam ft;
alur proses lengkap: **loading masuk → kupas serabut → belah → jemur (matahari langsung / greenhouse /
oven) → cungkil daging → produk jadi (kopra)**, plus **batok dikumpulkan → arang**; setiap kelapa
dipisah per **asal: dataran tinggi vs dataran rendah**.

Aturan yang tetap berlaku: angka TIDAK boleh dikarang → parameter proses baru masuk dataset proses
terpisah ber-sumber & ber-keyakinan (A/B/C), atau berupa input pengguna yang jelas ditandai.

Checklist (centang saat selesai + commit per langkah):
- [x] P1 Riset parameter proses (komposisi buah: sabut/batok/daging/air; beda dataran tinggi vs rendah;
      kadar air daging segar; muatan rak (kg/m²) & lama jemur per metode; rendemen arang sudah ada di
      dataset utama) → `architecture/00-research/data/coconut_process_dataset.json` + catatan sumber
      `architecture/00-research/process_research.md` + ADR-007.
- [x] P2 Paket dataset: skema Zod + loader dataset proses + test sumber/rentang.
- [x] P3 Engine `packages/calc-engine/src/process.ts` (fungsi murni, rentang, trace) + unit test.
- [ ] P4 UI `/proses`: tahapan bernomor, 2 jalur asal, kalkulator rak (3 metode), batok→arang,
      ringkasan produk jadi; bahasa santai.
- [ ] P5 Simulasi container: kelapa = lingkaran (SVG), ukuran container ditampilkan dalam ft/in.
- [ ] P6 Pass bahasa santai di seluruh UI (glosarium, hint, peringatan, tur, panduan).
- [ ] P7 E2E + run_all_checks + logs (decision/risk/traceability) + commit "Fase P selesai".
