# MULAI DI SINI — gemasSTUDIO

Folder ini berisi semua yang dibutuhkan Claude Code untuk membangun aplikasi gemasSTUDIO.

## Isi folder
```
gemasSTUDIO/
├─ MULAI_DI_SINI.md        ← file ini: langkah + prompt siap tempel
├─ CLAUDE.md               ← dibaca otomatis oleh Claude Code
└─ architecture/
   ├─ HANDOFF.md            ← status & batasan (baca dulu)
   ├─ CLAUDE_CODE_PROMPT.md ← prompt lengkap per fase M1–M5
   ├─ 00-research/          ← riset + dataset dimensi (sumber angka)
   ├─ 01-product/ … 05-ui-ux/  ← PRD, arsitektur, ERD, rumus, UX
   ├─ 06-design/            ← gaya Punk Skate Lab + 4 mockup
   ├─ 07-rnd/               ← modul R&D + parameter_template.csv (Anda isi)
   ├─ logs/ scripts/ tests/
```

## Persiapan (sekali saja, Windows)
1. Pasang **Node.js 20+**, **pnpm** (`npm i -g pnpm`), **Git** (sudah termasuk Git Bash), dan **Python 3**.
2. Pasang **PostgreSQL 16** (installer resmi atau Docker) — dibutuhkan mulai fase M2.
3. Buka terminal di folder `Documents\gemasSTUDIO`, lalu:
   ```bash
   git init
   git add .
   git commit -m "Arsitektur gemasSTUDIO v1"
   ```
4. Jalankan Claude Code di folder ini (`claude`).

---

## PROMPT 1 — Kickoff (tempel sekali di awal)

```
Kamu akan membangun aplikasi gemasSTUDIO di repo ini: kalkulator dimensi dan simulator
ruang inventory (gudang + container) untuk kelapa tua jambul, arang batok, kopra asalan,
dan kopra edible, plus modul R&D Lab untuk pencatatan batch produk turunan kelapa
(kopra edible, kopra asalan, bioleather, cuka kelapa).

Semua riset, data, desain, skema database, dan kontrak uji SUDAH SELESAI di folder
architecture/. Jangan riset ulang, jangan mengarang angka.

Sebelum menulis kode:
1. Baca CLAUDE.md di root, lalu architecture/HANDOFF.md dan architecture/CLAUDE.md.
2. Baca semua dokumen sesuai urutan di architecture/CLAUDE.md
   (PRD, ARD + ADR, calculation_spec, ERD + schema, ux_spec, 06-design, 07-rnd,
   golden_cases.json).
3. Jalankan: bash architecture/scripts/run_all_checks.sh  → harus "SEMUA CEK LULUS".
   (Di Windows pakai Git Bash. Kalau Python/psql belum ada, beri tahu aku.)

Lalu balas dengan:
- ringkasan pemahamanmu, maksimal 10 poin;
- rencana implementasi fase M1–M5 (struktur monorepo, paket, urutan file);
- pertanyaan HANYA untuk hal yang benar-benar ambigu (default ada di HANDOFF.md §6).

Jangan mulai menulis kode sampai aku menyetujui rencananya.
```

## PROMPT 2 — Jalankan fase (tempel setelah rencana disetujui, ulangi per fase)

Ganti `M1` dengan `M2`, `M3`, `M4`, lalu `M5` setelah tiap fase selesai dan Anda review.

```
Rencana disetujui. Kerjakan Fase M1 persis seperti bagian "Fase M1" di
architecture/CLAUDE_CODE_PROMPT.md (baca bagian itu sekarang dan ikuti seluruh
scope, aturan, dan test-nya).

Di akhir fase: perbarui architecture/logs/ (traceability_matrix, risk_issue_log,
decision_log bila ada keputusan baru), jalankan bash architecture/scripts/run_all_checks.sh,
commit dengan pesan "Fase M1 selesai", lalu BERHENTI dan laporkan:
hasil test, file yang dibuat, dan isu yang ditemukan.
```

Urutan fase:
| Fase | Isi |
|---|---|
| M1 | Engine kalkulasi + 17 golden test |
| M2 | Aplikasi web, database, kalkulator, gaya gemasSTUDIO |
| M3 | Simulator 2D & 3D |
| M4 | Sampling lapangan & kalibrasi data |
| M5 | R&D Lab (batch, tahap, form parameter dinamis) |

## PROMPT 3 — Saat parameter R&D sudah Anda isi

Isi `architecture/07-rnd/parameter_template.csv` (satu baris per parameter), lalu tempel:

```
Parameter R&D sudah ada di architecture/07-rnd/parameter_template.csv (sudah diisi).
Validasi file itu terhadap aturan rnd_param_def, laporkan baris yang bermasalah,
lalu impor lewat fitur impor aplikasi (bukan SQL manual) dan tunjukkan form batch
untuk tiap produk.
```

## Prompt darurat
- **Claude Code menebak angka:** `Stop. Semua angka harus dari architecture/00-research/data/coconut_inventory_dataset.json lewat packages/dataset. Tunjukkan sumber angka itu, lalu perbaiki.`
- **Golden test gagal dan ia mau mengubah file golden:** `Jangan ubah golden_cases.json. Hitung manual kasus itu langkah demi langkah sesuai calculation_spec.md lalu bandingkan dengan output engine.`
- **Tampilan melenceng dari desain:** `Bandingkan layar ini dengan architecture/06-design/mockups/ dan design_spec.md. Perbaiki agar memakai token (tanpa radius, garis 3px, bayangan keras, Bowlby One/Archivo/JetBrains Mono).`

## Masih perlu dari Anda
- Parameter R&D tiap produk → `architecture/07-rnd/parameter_template.csv`
- Konfirmasi tahap proses bioleather & cuka kelapa (`architecture/07-rnd/PRD_RnD.md` §6)
- Logo gemasSTUDIO (opsional; mockup memakai ikon sementara)
