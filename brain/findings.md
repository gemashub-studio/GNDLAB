# Temuan Teknis (FND)

Format: ID · tanggal · temuan · **Why** · **How to apply**. Terbaru di bawah.

### FND-001 · 2026-10-08 · Validator memakai volume container nominal, bukan L·W·H
`validate_dataset.py::container_fill` memakai `volume_m3` (20GP = 33,2), sedangkan calc_spec §1 mendefinisikan `V_c = L·W·H` (= 33,196). Selisih ≤ 0,07%.
- **Why:** golden cases dibangkitkan dari volume nominal; supaya engine identik (bukan sekadar dalam toleransi), engine menerima `container.volumeM3` opsional.
- **How to apply:** container dari dataset → isi `volumeM3`; container custom → biarkan kosong (engine pakai L·W·H). Lihat DEC-017.

### FND-002 · 2026-10-08 · Golden jambul pakai `round`, spesifikasi pakai `floor`
`expect_pcs = round(kg/m)` = 22.230; engine (`floor`, calc_spec §3.2) = 22.229. Selisih 1 butir (0,004%) — dalam toleransi ±0,5%.
- **Why:** jangan "memperbaiki" engine ke `round`; spesifikasi benar (tidak boleh menjanjikan butir yang tidak muat).
- **How to apply:** UI menampilkan hasil engine (floor). Bila owner bertanya selisih 1 butir vs dokumen, ini penjelasannya.

### FND-003 · 2026-10-08 · `floor` dalam meter rentan floating-point
Data dalam cm; setelah /100, pembagian pas (mis. 2,352/0,336 = 7) bisa jadi 6,9999999.
- **Why:** grid-fit & nested count memakai floor → salah 1 lapis = ratusan karung.
- **How to apply:** selalu pakai `floorDiv()` dari `@gemas/calc-engine` (epsilon 1e-9), jangan `Math.floor(a/b)` langsung. Ada unit test-nya.

### FND-004 · 2026-10-08 · Loader TS harus paritas 1:1 dengan seed_from_dataset.py
Key parameter di aplikasi (override, kalibrasi M4) harus sama persis dengan `parameter.key` di DB. Loader `packages/dataset` adalah port `unit_for`, `norm_key`, `ranges`, `FORMS` dari seed.
- **Why:** bila beda, override/kalibrasi akan merujuk parameter yang tidak ada di DB.
- **How to apply:** test `loader ↔ seed.sql` membandingkan 102 tuple (key, unit, min, typ, max, keyakinan). Jika seed script berubah, port perubahannya ke `loader.ts` dan test akan memberi tahu.

### FND-005 · 2026-10-08 · Parameter tanpa label keyakinan dianggap C
Berat bersih karung (`bag_net_kg`) & utilisasi volume default (0,8/0,9) tidak berlabel → C (aturan seed: "tanpa label → estimasi").
- **Why:** konsisten & konservatif; konsekuensinya mode PACKAGE dan arang lump selalu memunculkan `LOW_CONFIDENCE_PARAM`.
- **How to apply:** bila owner memverifikasi berat karung/utilisasi, tambahkan `confidence` di dataset (versi baru) — jangan ubah di kode.

### FND-006 · 2026-10-08 · Peringatan keselamatan dievaluasi di kasus terburuk
`SELF_HEATING_RISK` memakai `moisture.max > 10%`, `FLOOR_OVERLOAD` memakai `q_floor.max`. Peringatan lain memakai `typ`. (DEC-016)

### FND-007 · 2026-10-08 · Arah dependensi paket: dataset → calc-engine
`@gemas/dataset` bergantung pada `@gemas/calc-engine` (branded types, `overrideParam`). Engine tetap **zero dependency**; golden test engine membaca JSON langsung via `fs` (bukan lewat paket dataset) untuk menghindari siklus.

### FND-008 · 2026-10-08 · Skrip Python menulis CRLF di Windows
`run_all_checks.sh` membangkitkan ulang `seed.sql`, `data_dictionary.md`, `validation_log.md`, `golden_cases.json` dengan CRLF. `.gitattributes` (`eol=lf`) menormalkan saat commit → diff bersih.
- **How to apply:** abaikan peringatan "CRLF will be replaced by LF"; jangan commit file hasil bangkitan dengan perubahan isi kecuali dataset berubah. `validation_log.md` selalu berubah (timestamp) — wajar.

### FND-009 · 2026-10-08 · Bentuk `trace` mengikuti ARD §6
calc_spec §8 menulis `trace: Record<param, …>`; ARD §6 memakai `{datasetVersion, params}`. Dipilih bentuk ARD + `engineVersion` (untuk kolom `calc_result.engine_version`). DEC-015.

### FND-010 · 2026-10-08 · PostgreSQL lokal butuh password superuser
Installer winget PostgreSQL 16 (unattended) menyetel password yang tidak diketahui owner. Agent **tidak boleh menebak**. Solusi: owner menjalankan `scripts/windows/reset-postgres-password.ps1` (minta UAC, trust sementara → password acak → pg_hba dikembalikan di `finally` → simpan ke `%APPDATA%\postgresql\pgpass.conf`). Sudah dijalankan 2026-10-08; koneksi `postgresql://postgres@localhost:5432/postgres` kini tanpa password di URL.

### FND-011 · 2026-10-08 · psql Windows tidak mempermutasi argumen
`psql "$URL" -c "…"` di Windows mengabaikan `-c` (opsi setelah argumen posisi). Selalu tulis `psql -d "$URL" -c …`. Berlaku juga untuk skrip M2 (migrasi, seed). ISS-018.

### FND-012 · 2026-10-08 · Menjalankan bash dari PowerShell 5.1
`bash.exe -c '…'` dengan path berspasi bisa menelan output. Pola andal: tulis skrip `.sh` (scratchpad) lalu `& "C:\Program Files\Git\bin\bash.exe" path\skrip.sh`. PATH bash harus memuat `/c/Users/user/AppData/Local/Programs/Python/Python312` (alias Microsoft Store `python` menghalangi) dan `/c/Program Files/PostgreSQL/16/bin`.
