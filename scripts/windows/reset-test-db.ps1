# Reset database TEST (gemas_test) agar uji kalibrasi (calibration.db.test.ts) bisa diulang dari awal.
# HANYA menyentuh TEST_DATABASE_URL di apps/web/.env, tidak pernah database dev.
# Dijalankan oleh owner sendiri (Prisma menolak reset yang dijalankan agen AI tanpa persetujuan).
# Pemakaian (dari folder repo):  powershell -ExecutionPolicy Bypass -File scripts\windows\reset-test-db.ps1
$ErrorActionPreference = 'Stop'
$web = Join-Path $PSScriptRoot '..\..\apps\web'
$envFile = Join-Path $web '.env'
$line = Get-Content $envFile | Where-Object { $_ -match '^TEST_DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw 'TEST_DATABASE_URL tidak ada di apps/web/.env. Jalankan setup-dev-db.ps1 dulu.' }
$url = ($line -replace '^TEST_DATABASE_URL=', '').Trim('"')
if ($url -notmatch '/gemas_test(\?|$)') { throw 'TEST_DATABASE_URL bukan gemas_test, dibatalkan demi keamanan.' }
Push-Location $web
try {
  $env:DATABASE_URL = $url
  node node_modules\prisma\build\index.js migrate reset --force --skip-seed --skip-generate
  Write-Host 'gemas_test sudah kosong. Test berikutnya akan seed ulang otomatis (test/db-setup.ts).'
} finally {
  Pop-Location
}
