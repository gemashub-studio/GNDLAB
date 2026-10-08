---
doc: Handoff
title: Handoff — Riset & Arsitektur → Implementasi Aplikasi (Claude Code)
from: Fase riset & arsitektur (claude.ai)
to: Claude Code (implementasi)
owner: masciosa@gmail.com
date: 2026-10-08
dataset_version: 1.0.4
architecture_version: 1.0.0
---

# HANDOFF — gemasSTUDIO — Coco Inventory & R&D Lab

## 1. Status Singkat

| Area | Status | Bukti |
|---|---|---|
| Riset dimensi, berat, densitas 4 produk | ✅ Lengkap untuk v1 (dengan catatan §4) | `00-research/research_report.md` §1–5 |
| Dimensi **unit** per produk | ✅ 4/4 produk | research_report §5, `data_dictionary.md` |
| Dimensi **kemasan terisi** per produk | ✅ 5/5 kemasan | dataset v1.0.4, uji `pack.*` di `validation_log.md` |
| Benchmark muat container | ✅ 3 dari 4 produk (kopra asalan belum ada di pasar) | `container_benchmarks` di dataset |
| Validasi dataset | ✅ 105 PASS · 0 FAIL · 1 WARN (disengaja) | `logs/validation_log.md` |
| PRD / ARD / 5 ADR / ERD / spes. kalkulasi / spes. UX | ✅ | folder `01`–`05` |
| Skema PostgreSQL 16 | ✅ 18/18 uji integritas lulus di Postgres sungguhan | `tests/schema_integrity_test.sql` |
| Seed data → DB | ✅ termuat bersih (22 sumber, 102 parameter, 14 kemasan, 9 benchmark) | `03-data/seed.sql` |
| Kontrak uji engine | ✅ 17 golden cases | `tests/fixtures/golden_cases.json` |
| Konsep visual gemasSTUDIO "Punk Skate Lab" | ✅ 4 layar + token + preset Tailwind; kontras 11/11 pasangan lulus WCAG | `06-design/` |
| Modul R&D Lab (skema & PRD) | ✅ 21/21 uji lulus · 4 produk · 26 tahap template | `07-rnd/`, `tests/rnd_integrity_test.sql` |
| Parameter produk R&D | ⏳ **Menunggu owner** mengisi `07-rnd/parameter_template.csv` | – |
| **Kode aplikasi** | ⏳ **Belum dimulai — inilah tugas Claude Code** | – |

## 2. Lembar Dimensi per Produk (ringkas)

| Produk | Unit (P×L×T cm) | Berat unit | Densitas acuan (kg/m³) | Karung terisi (P×L×T cm) | Isi karung | 20GP |
|---|---|---|---|---|---|---|
| Kelapa jambul | 13,5 × 9,5 × 9,5 | 575 g | 483 lepas · 385 dlm karung | 49 × 34 × 21 | 25 butir ≈ 14 kg | ≈ 22.500 butir |
| Arang batok belah 2 utuh | Ø8,4 × 4,4 (dinding 0,35) | 25 g | 85 lepas ⚠ · 145 bersarang ⚠ | – | – | volume-limited |
| Arang batok lump | – | – | 475 | 64 × 45 × 21 · jumbo 95 × 95 × 130 | 25 kg · 550 kg | 12–13 t |
| Kopra asalan | 8 × 5 × 1,1 | 60 g | 500 curah · 440 karung | 88 × 55 × 27 | 50 kg | ≈ 13 t (prediksi) |
| Kopra edible | Ø8 × 4 (tebal 1,2) | 80 g | 350 lepas · 320 dlm karung | 79 × 53 × 18 | 25 kg | 10–11 t |

Rentang min–max & sumber setiap angka: `00-research/research_report.md` dan `03-data/data_dictionary.md`.

## 3. Yang Diserahkan

```
architecture/
├─ HANDOFF.md                ← dokumen ini
├─ CLAUDE_CODE_PROMPT.md     ← prompt siap tempel untuk Claude Code (kickoff + per fase)
├─ CLAUDE.md                 ← aturan kerja permanen untuk Claude Code
├─ README.md                 ← peta folder
├─ 00-research/              ← laporan riset + dataset JSON (sumber kebenaran)
├─ 01-product/PRD.md
├─ 02-architecture/ARD.md + adr/ADR-001..005
├─ 03-data/ERD.md, schema.sql, seed.sql, data_dictionary.md
├─ 04-calculation/calculation_spec.md
├─ 05-ui-ux/ux_spec.md
├─ 06-design/                ← gaya Punk Skate Lab: tokens, Tailwind preset, CSS, 4 mockup
├─ 07-rnd/                   ← PRD R&D, schema_rnd.sql, parameter_template.csv
├─ logs/                     ← changelog, research, asumsi, keputusan, risiko/isu, verifikasi lapangan, traceability, validasi
├─ scripts/                  ← validator, generator seed & kamus data, run_all_checks.sh
└─ tests/                    ← uji integritas SQL + golden cases
```

## 4. Batasan yang Harus Diketahui (jujur)

1. **30 dari 45 parameter masih estimasi (keyakinan C).** Angkanya konsisten secara fisika dan cocok dengan benchmark pasar, tetapi belum diukur langsung. Aplikasi wajib menampilkannya dengan badge C. Daftar & cara verifikasi: `logs/assumption_register.md` (ASM-01..19).
2. **Arang batok belah 2 utuh** tidak punya data densitas publik. Nilai 85 kg/m³ (rentang 50–155) adalah turunan fisika. **Jangan dipakai untuk memesan container sebelum uji kotak volume** (`logs/field_verification_log.md`).
3. **Kopra asalan** belum punya benchmark muat container dari pasar; prediksi ≈ 13 t/20GP perlu dicek dengan realisasi stuffing pertama.
4. Data kelapa jambul berbasis studi India/Filipina dengan koreksi untuk kelapa Dalam Indonesia — perlu sampling 30 butir/lot.
5. Satu sumber pasar menyebut 10–11 ribu butir/20ft (jauh di bawah 22.500). Dipertahankan sebagai skenario konservatif (WARN), bukan dibuang.

Batasan ini **tidak memblokir pembangunan aplikasi** — justru fitur sampling & kalibrasi (M4) dibuat untuk menutupnya dengan data Anda sendiri.

## 5. Keputusan yang Sudah Dikunci

| Keputusan | Dokumen |
|---|---|
| Satu engine TypeScript murni untuk client & server | ADR-001 |
| Dataset terversi & immutable; override per skenario; kalibrasi lewat proposal | ADR-002 |
| Semua nilai rentang {min, typ, max}; min/max via evaluasi sudut | ADR-003 |
| Satuan internal SI | ADR-004 |
| Model muat = densitas efektif + grid kemasan | ADR-005 |
| Stack: Next.js 15 + TS + Tailwind, PostgreSQL 16 + Prisma, three.js, Vitest/Playwright, pnpm + Turborepo | ARD §4 |

## 6. Keputusan yang Masih Terbuka (Claude Code boleh pakai default, tapi tanyakan bila Anda punya preferensi)

| Topik | Default yang disarankan | Catatan |
|---|---|---|
| Hosting | Vercel (web) + Postgres terkelola (Neon/Supabase) | Bisa juga VPS + Docker |
| Autentikasi | NextAuth email magic link | Hanya untuk simpan skenario & kalibrasi; kalkulator tetap publik/offline |
| Bahasa UI | Bahasa Indonesia (EN opsional, FR-13) | |
| Nama aplikasi | **gemasSTUDIO** (ditetapkan owner) | Logo resmi belum ada; mockup memakai ikon kelapa sementara |
| Container tambahan (truk, reefer, 45HC) | Lewat fitur container custom | Tambah ke dataset bila sering dipakai |

## 7. Definisi Selesai Proyek (v1)

- [ ] `pnpm test` — 17/17 golden cases + unit test engine lulus
- [ ] `bash architecture/scripts/run_all_checks.sh` tetap lulus (dengan `PGURL`)
- [ ] US-01..US-11 di PRD lulus uji E2E (Playwright)
- [ ] Kalkulator jalan offline (PWA) di HP 360 px
- [ ] Simulator 2D & 3D menampilkan angka yang sama dengan kalkulator
- [ ] Alur sampling → usulan kalibrasi → approval → dataset versi baru berjalan
- [ ] Modul R&D: RD-01..RD-10 lulus E2E; form parameter dinamis dari `rnd_param_def`
- [ ] Tampilan mengikuti `06-design/` (token, tanpa radius, bayangan keras)
- [ ] `logs/traceability_matrix.md` semua baris ✅

## 8. Cara Memulai

1. Buat repo baru, salin folder `architecture/` ke root repo.
2. Buka Claude Code di root repo.
3. Tempel **Prompt Kickoff** dari `CLAUDE_CODE_PROMPT.md`.
4. Lanjutkan dengan prompt Fase M1 → M5 satu per satu; review hasil tiap fase sebelum lanjut.
5. Isi `07-rnd/parameter_template.csv` dengan parameter produk (boleh menyusul — M5 tetap bisa dibangun dengan empty-state).
