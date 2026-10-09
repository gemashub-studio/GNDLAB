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
| M3 | Simulator 2D SVG + 3D r3f | ✅ 2026-10-09 | engine 93 (layout 11), E2E simulator 10 (1.892 karung ±48 fps) |
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
- [x] P4 UI `/proses`: tahapan bernomor, 2 jalur asal, kalkulator rak (3 metode), batok→arang,
      ringkasan produk jadi; bahasa santai.
- [x] P5 Simulasi container: kelapa = lingkaran (SVG), ukuran container ditampilkan dalam ft/in.
- [x] P6 Pass bahasa santai di seluruh UI (glosarium, hint, peringatan, tur, panduan).
- [x] P7 E2E + run_all_checks + logs (decision/risk/traceability) + commit "Fase P selesai".

## Fase M3 — Simulator 2D & 3D (mulai 2026-10-09)

Spesifikasi: `architecture/CLAUDE_CODE_PROMPT.md` §3, ux_spec §3.3, ADR-005. Angka simulator HARUS identik
dengan kartu hasil kalkulator (pakai engine yang sama, bukan hitung ulang di komponen).

Checklist (centang + commit per langkah; kalau sesi putus, lanjut dari yang belum dicentang):
- [x] S1 Engine `layout.ts`: posisi kemasan dalam container (urutan muat belakang→depan, bawah→atas,
      dari `bestGridFit`), tata letak tumpukan gudang di zona (lorong), kolom bersarang arang; unit test
      (jumlah posisi = `containerCapacity().packs` untuk semua golden kemasan).
- [x] S2 Denah 2D SVG: tampak atas & samping container; denah zona gudang dengan lorong diarsir; hover isi tumpukan.
- [x] S3 3D (three.js + @react-three/fiber, tanpa drei): kotak transparan, karung = InstancedMesh, slider
      "isi %", orbit; dimuat dinamis (tanpa SSR); label "representasi grid".
- [x] S4 Halaman `/simulator` (baca `?s=` dari kalkulator/gudang) + tombol "Buka simulator" di kalkulator & gudang;
      mode arang belah 2 bersarang (kolom).
- [x] S5 Test: unit layout + E2E angka simulator == kartu hasil untuk golden kemasan; ukur fps 1.200 karung.
- [x] S6 Logs (traceability FR-09, decision, risk) + run_all_checks + commit "Fase M3 selesai".

## Fase M4 — Sampling lapangan & kalibrasi (mulai 2026-10-09)

Spesifikasi: `architecture/CLAUDE_CODE_PROMPT.md` §4, PRD US-08, ADR-002, ERD MEASUREMENT/CALIBRATION_PROPOSAL/AUDIT_LOG,
`architecture/logs/assumption_register.md` (prioritas ASM-01, ASM-02, ASM-06), `field_sampling_template.csv`.

Desain kunci (dicatat sebagai ADR-008 saat K5):
- Versi dataset baru = salinan baris versi aktif + nilai parameter yang disetujui (confidence → A, "terukur sendiri").
- Engine untuk versi X = dataset ter-bundle (basis v1.0.4) + override parameter dari DB versi X (patch hanya mengubah nilai).
- Client mengambil override versi aktif saat online & menyimpannya untuk offline; server selalu pakai DB.
- Realisasi stuffing → densitas efektif tersirat → disimpan sebagai sampel `bulk_density` (method realisasi_stuffing) + selisih vs prediksi (target ≤ 10%, PRD §8).

Checklist (centang + commit per langkah):
- [x] K1 Murni: `stats.ts` di calc-engine (n, mean, SD, min, max, P5/median/P95) + `applyParameterOverrides`/`diffParameters` di dataset + test.
- [x] K2 Server versi: dataset per versi dari DB (async), endpoint calculate pakai versi aktif, `/datasets/active` kirim override, client `useDataset` pakai override (+ cache offline).
- [x] K3 Sampling: parser CSV (format persis template) + validasi per baris, service & API `POST /measurements`, statistik, usulan otomatis n ≥ 10.
- [x] K4 Approval: service setujui/tolak (data_admin) → versi patch baru PUBLISHED, versi lama utuh (IR-02), audit actor; API; test integrasi DB alur penuh + skenario lama tetap.
  - Selesai: `server/calibration.ts`, `server/approval.ts`, API `POST /measurements`, `GET /measurements/stats`, `GET /proposals`, `POST /proposals/[id]`; uji `test/calibration.db.test.ts` (11) di DB `gemas_test`. Uji kalibrasi hanya jalan di DB test segar → owner menjalankan `scripts/windows/reset-test-db.ps1` untuk mengulang (FND-020).
- [ ] K5 UI: /sampling (form + impor CSV + statistik + prioritas ASM), /kalibrasi (review), realisasi stuffing.
- [ ] K6 E2E alur penuh (sesi uji via JWT), logs (ADR-008, traceability FR-11/US-08), run_all_checks, commit "Fase M4 selesai".
