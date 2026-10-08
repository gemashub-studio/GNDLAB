# Simpan password PostgreSQL lokal agar uji database gemasSTUDIO bisa berjalan.
# Password diketik oleh Anda sendiri dan hanya disimpan di komputer ini:
#   %APPDATA%\postgresql\pgpass.conf
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psql)) { Write-Host "PostgreSQL 16 tidak ditemukan di $psql" -ForegroundColor Red; exit 1 }

$secure = Read-Host "Ketik password user 'postgres' (tidak akan terlihat saat diketik)" -AsSecureString
$pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$env:PGPASSWORD = $pw
& $psql -h localhost -U postgres -d postgres -w -tAc "select 'OK'" 2>$null | Out-Null
$ok = $LASTEXITCODE -eq 0
Remove-Item Env:PGPASSWORD

if (-not $ok) {
  Write-Host "Password salah atau server belum jalan. Tidak ada yang disimpan." -ForegroundColor Red
  Write-Host "Kalau Anda tidak tahu password-nya, beri tahu Claude: 'saya tidak tahu password postgres'."
  exit 1
}

$dir = Join-Path $env:APPDATA "postgresql"
New-Item -ItemType Directory -Force $dir | Out-Null
[IO.File]::WriteAllText((Join-Path $dir "pgpass.conf"), "localhost:5432:*:postgres:$pw`n")
Write-Host "Berhasil. Password tersimpan, koneksi database OK." -ForegroundColor Green
