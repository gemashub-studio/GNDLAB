# gemasSTUDIO — instruksi proyek untuk Claude Code

Proyek ini membangun **gemasSTUDIO**: kalkulator dimensi & simulator ruang inventory (gudang + container) untuk komoditas kelapa, plus **R&D Lab** untuk pencatatan batch produk turunan kelapa.

Semua riset, data, desain, skema database, dan kontrak uji **sudah selesai dan tervalidasi** di folder `architecture/`. Jangan riset ulang dan jangan mengarang angka.

## Wajib dibaca sebelum menulis kode
1. `architecture/HANDOFF.md` — status, batasan data, keputusan terbuka
2. `architecture/CLAUDE.md` — aturan kerja lengkap (ikuti selama proyek)
3. Dokumen lain sesuai urutan di `architecture/CLAUDE.md`

## Aturan singkat
- Sumber angka satu-satunya: `architecture/00-research/data/coconut_inventory_dataset.json`.
- `architecture/tests/fixtures/golden_cases.json` adalah kontrak: 17/17 harus lulus. Jangan diedit manual.
- Gaya visual wajib dari `architecture/06-design/` (**Lab Futuristik**, ADR-011). Punk Skate Lab sudah tidak dipakai.
- Parameter R&D adalah DATA di `rnd_param_def`, jangan pernah di-hardcode.
- Kerjakan per fase M1 → M5. Selesai tiap fase: perbarui `architecture/logs/`, jalankan `bash architecture/scripts/run_all_checks.sh`, lalu berhenti dan laporkan.

## Memori bersama (otak kedua)
- `brain/` adalah memori lintas agent: baca `brain/plan.md` + entri terakhir `brain/sessions.md` di awal sesi, catat temuan di `brain/findings.md`, tutup sesi dengan entri di `brain/sessions.md`. Protokol: `brain/README.md`.

## Perintah validasi
```bash
pnpm test        # golden 17/17 + unit test engine & dataset
pnpm typecheck
```

```bash
bash architecture/scripts/run_all_checks.sh
PGURL=postgresql://postgres@localhost:5432/postgres bash architecture/scripts/run_all_checks.sh   # + uji database
```
Di Windows jalankan lewat Git Bash atau WSL (butuh Python 3; uji database butuh PostgreSQL 16 + psql).
