# Lingkungan Kerja (mesin owner, Windows 10 Pro)

Dipasang 2026-10-08 lewat winget: Node.js 24 LTS, Git 2.55 (termasuk Git Bash), Python 3.12, PostgreSQL 16 (service `postgresql-x64-16`), pnpm 9.15 (`npm i -g pnpm@9`). WSL **tidak** terpasang.

## Perintah
```bash
pnpm install
pnpm test                                     # turbo: test semua paket (golden + unit)
pnpm typecheck
bash architecture/scripts/run_all_checks.sh   # dari Git Bash
```
PowerShell: shell agent tidak me-refresh PATH otomatis setelah instalasi. Awali dengan
`$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") + ";$env:APPDATA\npm"`.
Git Bash: `& "C:\Program Files\Git\bin\bash.exe" architecture/scripts/run_all_checks.sh`.

Turbo mengirim telemetri anonim secara default; agent menjalankan dengan `TURBO_TELEMETRY_DISABLED=1`. Owner bisa mematikan permanen: `pnpm turbo telemetry disable`.

## PostgreSQL (dibutuhkan mulai M2)
- psql: `C:\Program Files\PostgreSQL\16\bin\psql.exe` (belum di PATH).
- ✅ Password sudah di-reset (2026-10-08) lewat `scripts/windows/reset-postgres-password.ps1` dan tersimpan di `%APPDATA%\postgresql\pgpass.conf`. Agent tidak perlu (dan tidak boleh) membaca password-nya; libpq membacanya otomatis.
- URL: `postgresql://postgres@localhost:5432/postgres`.
- Uji DB: `PGURL=… bash architecture/scripts/run_all_checks.sh` dengan PATH bash memuat Python312 & PostgreSQL bin (FND-012). Hasil terakhir: 18/18 integritas, seed OK, R&D 21/21.

## Git
Identitas lokal repo: `masciosa <masciosa@gmail.com>` (bisa diganti owner). Branch `main`. Belum ada remote.

## Catatan menjalankan test (2026-10-09)
- `pnpm turbo …` / `pnpm exec playwright …` dari **Git Bash** kadang menggantung tanpa output. Andal dari **PowerShell**:
  - unit: `node ..\..\node_modules\vitest\vitest.mjs run` di folder paket; typecheck: `node ..\..\node_modules\typescript\bin\tsc --noEmit`
  - E2E: `node node_modules/@playwright/test/cli.js test` di `apps/web` (Edge terpasang, tanpa unduh browser).
