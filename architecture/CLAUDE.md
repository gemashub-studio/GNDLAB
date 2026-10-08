# CLAUDE.md — Instruksi untuk Claude Code

Anda membangun **gemasSTUDIO — Coco Inventory & R&D Lab** dari spesifikasi di folder ini. Baca dokumen dengan urutan ini sebelum menulis kode:

0. `HANDOFF.md` — status, batasan data, keputusan terbuka
1. `01-product/PRD.md` — apa & untuk siapa (user story US-01..11 berisi acceptance criteria berangka)
2. `02-architecture/ARD.md` + `adr/` — stack, struktur repo, kontrak API
3. `04-calculation/calculation_spec.md` — **semua rumus**; ini spesifikasi engine
4. `03-data/ERD.md`, `schema.sql`, `data_dictionary.md` — model data
5. `05-ui-ux/ux_spec.md` — layar & perilaku UI
6. `06-design/design_spec.md` + `tokens.json` + `tailwind.preset.ts` + `globals.css` — gaya visual **Punk Skate Lab** (menggantikan token di ux_spec §5); mockup acuan di `06-design/mockups/`
7. `07-rnd/PRD_RnD.md` + `schema_rnd.sql` — modul R&D Lab

## Aturan Wajib

- **Sumber kebenaran data** = `00-research/data/coconut_inventory_dataset.json`. Jangan menyalin angka secara manual ke kode; muat & validasi dengan Zod saat build.
- **Engine** (`packages/calc-engine`) adalah fungsi murni TypeScript tanpa I/O (ADR-001), satuan SI (ADR-004), semua parameter berupa `{min, typ, max}` (ADR-003).
- **Golden cases** `tests/fixtures/golden_cases.json` adalah kontrak: buat `golden.test.ts` yang memuat file ini dan **semua 17 kasus harus lulus** (toleransi ±0,5%). Jangan mengubah file golden secara manual — ia dibangkitkan `scripts/validate_dataset.py`.
- Skema DB: gunakan `03-data/schema.sql` apa adanya (atau terjemahkan 1:1 ke Prisma + migrasi SQL mentah untuk trigger & CHECK). Uji dengan `tests/schema_integrity_test.sql`.
- Setiap hasil kalkulasi wajib mengembalikan `binding`, `warnings`, dan `trace` (calculation_spec §1, §6, §8).
- Parameter berkeyakinan **C** harus tampil dengan badge & peringatan `LOW_CONFIDENCE_PARAM`.
- Jangan pernah menampilkan simulasi 3D tanpa label "representasi grid" (ADR-005).
- Nama aplikasi: **gemasSTUDIO**. Gaya visual wajib dari `06-design/` (tanpa radius, garis 3px, bayangan keras, aksen #C6F135 & #FF5A1F). Jangan memakai warna/komponen di luar token tanpa ADR.
- Modul R&D: parameter produk adalah DATA di `rnd_param_def` — **jangan pernah meng-hardcode parameter** sebagai kolom atau field form. Form dibangkitkan dari definisi.

## Urutan Implementasi (milestone PRD §9)

1. **M1 Engine** — `range.ts` (evaluasi sudut 2^k), `units.ts`, `container.ts` (mode BULK/PIECE/PACKAGE), `warehouse.ts`, `moisture.ts`, `nesting.ts`, `grid.ts` → golden tests hijau.
2. **M2 UI Kalkulator** — Next.js App Router, form → kartu hasil + pita rentang + bar volume/berat.
3. **M3 Simulator** — SVG 2D denah, three.js isometrik.
4. **M4 Data lapangan** — form sampling, usulan kalibrasi, alur approval `data_admin`.
5. **M5 R&D Lab** — batch, tahap, form parameter dinamis, impor `parameter_template.csv`, out-of-spec, perbandingan batch.

## Definisi Selesai per Fitur

- Unit test + golden test lulus; `bash scripts/run_all_checks.sh` tetap lulus.
- Kebutuhan terkait di `logs/traceability_matrix.md` diperbarui dari ⏳ ke ✅ dengan bukti uji.
- Keputusan baru yang berdampak arsitektur → ADR baru + baris di `logs/decision_log.md`.
- Bug/temuan → baris di `logs/risk_issue_log.md`; perubahan data → `logs/CHANGELOG.md` + naikkan `meta.version`.

## Perintah

```bash
bash scripts/run_all_checks.sh                    # validasi data + seed + tautan
PGURL=postgresql://postgres@localhost:5432/postgres bash scripts/run_all_checks.sh   # + uji DB (inventory + R&D)
```
