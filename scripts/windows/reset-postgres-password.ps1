# Reset password user 'postgres' di PostgreSQL 16 lokal (untuk pengembangan gemasSTUDIO).
# Langkah: (1) sementara izinkan login lokal tanpa password, (2) buat password acak baru,
# (3) kembalikan pengaturan keamanan seperti semula, (4) simpan password di
# %APPDATA%\postgresql\pgpass.conf agar alat pengembangan bisa terhubung.
# Butuh hak Administrator (Windows akan menampilkan jendela izin).
param([string]$TargetAppData = $env:APPDATA)

$ErrorActionPreference = 'Stop'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Meminta izin Administrator... klik 'Yes' pada jendela yang muncul."
  Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-TargetAppData', "`"$env:APPDATA`"")
  exit
}

$svc  = 'postgresql-x64-16'
$bin  = 'C:\Program Files\PostgreSQL\16\bin'
$hba  = 'C:\Program Files\PostgreSQL\16\data\pg_hba.conf'
$bak  = "$hba.gemas-backup"

# Password acak 24 karakter (huruf & angka saja agar aman di file pgpass)
$chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 24; $rng.GetBytes($bytes)
$newPw = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })

$ok = $false
Copy-Item $hba $bak -Force
try {
  Write-Host "1/4 Mengizinkan login lokal sementara..."
  (Get-Content $hba) -replace '^(host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+)scram-sha-256', '${1}trust' |
    Set-Content $hba -Encoding ascii
  Restart-Service $svc

  Write-Host "2/4 Mengganti password..."
  & "$bin\psql.exe" -h localhost -U postgres -d postgres -w -v ON_ERROR_STOP=1 -qc "ALTER USER postgres WITH PASSWORD '$newPw'"
  if ($LASTEXITCODE -ne 0) { throw "Gagal mengganti password" }
  $ok = $true
}
finally {
  Write-Host "3/4 Mengembalikan pengaturan keamanan seperti semula..."
  Copy-Item $bak $hba -Force
  Remove-Item $bak -Force
  Restart-Service $svc
}

if ($ok) {
  $dir = Join-Path $TargetAppData 'postgresql'
  New-Item -ItemType Directory -Force $dir | Out-Null
  [IO.File]::WriteAllText((Join-Path $dir 'pgpass.conf'), "localhost:5432:*:postgres:$newPw`n")
  $env:PGPASSFILE = Join-Path $dir 'pgpass.conf'
  & "$bin\psql.exe" -h localhost -U postgres -d postgres -w -tAc "select 1" | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "4/4 BERHASIL. Database siap dipakai." -ForegroundColor Green
    Write-Host "Password baru tersimpan di: $dir\pgpass.conf (simpan juga di tempat aman bila perlu)."
  } else {
    Write-Host "Password diganti, tetapi tes koneksi gagal. Beri tahu Claude." -ForegroundColor Yellow
  }
} else {
  Write-Host "Reset GAGAL. Pengaturan sudah dikembalikan seperti semula. Beri tahu Claude." -ForegroundColor Red
}
Read-Host "Tekan Enter untuk menutup jendela ini"
