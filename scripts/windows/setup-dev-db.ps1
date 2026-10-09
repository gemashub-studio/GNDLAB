# Siapkan database pengembangan gemasSTUDIO (aman diulang).
#  - role aplikasi `gemas_app` (bukan superuser) dengan password acak
#  - database `gemas_dev` milik gemas_app
#  - apps/web/.env berisi DATABASE_URL & NEXTAUTH_SECRET (file ini di-.gitignore)
#  - migrasi Prisma, seed dataset, terbitkan versi aktif
# Superuser dibaca dari %APPDATA%\postgresql\pgpass.conf (lihat reset-postgres-password.ps1).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$web = Join-Path $root 'apps\web'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$su = 'postgresql://postgres@localhost:5432/postgres'
$envFile = Join-Path $web '.env'

function New-Secret([int]$n) {
  $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { $chars[$_ % $chars.Length] })
}
function Sql([string]$q) {
  $out = & $psql -w -d $su -v ON_ERROR_STOP=1 -tAc $q
  if ($LASTEXITCODE -ne 0) { throw "psql gagal: $q" }
  $out
}

if (Test-Path $envFile) {
  Write-Host ".env sudah ada - memakai kredensial yang ada."
  $dbUrl = (Get-Content $envFile | Where-Object { $_ -like 'DATABASE_URL=*' }) -replace '^DATABASE_URL="?([^"]*)"?$', '$1'
} else {
  $pw = New-Secret 24
  if ((Sql "select 1 from pg_roles where rolname='gemas_app'") -eq '1') {
    Sql "ALTER ROLE gemas_app WITH LOGIN PASSWORD '$pw'" | Out-Null
  } else {
    Sql "CREATE ROLE gemas_app WITH LOGIN PASSWORD '$pw'" | Out-Null
  }
  $dbUrl = "postgresql://gemas_app:$pw@localhost:5432/gemas_dev"
  $secret = New-Secret 48
  $content = @(
    "# Dibuat scripts/windows/setup-dev-db.ps1 - JANGAN di-commit.",
    "DATABASE_URL=`"$dbUrl`"",
    "NEXTAUTH_URL=`"http://localhost:3000`"",
    "NEXTAUTH_SECRET=`"$secret`"",
    "# Kosongkan EMAIL_SERVER untuk mode dev: tautan login dicetak di terminal server.",
    "EMAIL_SERVER=`"`"",
    "EMAIL_FROM=`"gemasSTUDIO <noreply@localhost>`"",
    "# Email yang otomatis mendapat peran data_admin saat login pertama (pisahkan dengan koma).",
    "ADMIN_EMAILS=`"`""
  ) -join "`n"
  [IO.File]::WriteAllText($envFile, $content + "`n")
  Write-Host ".env dibuat."
}

if ((Sql "select 1 from pg_database where datname='gemas_dev'") -ne '1') {
  Sql "CREATE DATABASE gemas_dev OWNER gemas_app" | Out-Null
  Write-Host "Database gemas_dev dibuat."
}
# Database khusus test integrasi (di-reset otomatis oleh test; JANGAN dipakai untuk data asli).
if ((Sql "select 1 from pg_database where datname='gemas_test'") -ne '1') {
  Sql "CREATE DATABASE gemas_test OWNER gemas_app" | Out-Null
  Write-Host "Database gemas_test dibuat."
}
if (-not (Select-String -Path $envFile -Pattern '^TEST_DATABASE_URL=' -Quiet)) {
  $testUrl = $dbUrl -replace '/gemas_dev$', '/gemas_test'
  Add-Content -Path $envFile -Value "TEST_DATABASE_URL=`"$testUrl`"" -Encoding ascii
  Write-Host "TEST_DATABASE_URL ditambahkan ke .env."
}

Push-Location $web
try {
  & pnpm exec prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'migrate deploy gagal' }
  $hasSeed = & $psql -w -d ($su -replace '/postgres$', '/gemas_dev') -tAc "select count(*) from dataset_version"
  if ($hasSeed -eq '0') {
    & pnpm exec prisma db execute --file ../../architecture/03-data/seed.sql --schema prisma/schema.prisma
    if ($LASTEXITCODE -ne 0) { throw 'seed gagal' }
    Write-Host "Seed dataset dimuat."
  }
  & pnpm exec prisma db execute --file prisma/publish-seed.sql --schema prisma/schema.prisma
  & pnpm exec prisma generate | Out-Null
  Write-Host "Database siap." -ForegroundColor Green
} finally { Pop-Location }
