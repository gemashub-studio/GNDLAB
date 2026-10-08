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
- Superuser `postgres` memakai password yang diset installer. **Owner** (bukan agent) mengisi salah satu:
  - `%APPDATA%\postgresql\pgpass.conf` berisi `localhost:5432:*:postgres:<password>`, atau
  - variabel `PGPASSWORD` di sesi terminalnya sendiri.
- Lalu: `PGURL=postgresql://postgres@localhost:5432/postgres bash architecture/scripts/run_all_checks.sh`.

## Git
Identitas lokal repo: `masciosa <masciosa@gmail.com>` (bisa diganti owner). Branch `main`. Belum ada remote.
