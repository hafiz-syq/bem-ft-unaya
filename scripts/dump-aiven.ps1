# Dump database Aiven lewat mysqldump.
## Dipanggil oleh scripts\backup-database.bat saat DATABASE_URL di backend\.env
# menunjuk ke aivencloud.com:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dump-aiven.ps1 `
#     -MysqldumpExe  "C:\laragon\...\bin\mysqldump.exe" `
#     -EnvFile       "D:\...\backend\.env" `
#     -CaPem         "D:\...\backend\prisma\aiven-ca.pem" `
#     -Target        "D:\...\backups\bem_ft_unaya_<stamp>.sql"
#
# Kredensial dibaca dari DATABASE_URL dan TIDAK pernah dicetak; hasil dump
# ditulis langsung ke -Target.
param(
  [Parameter(Mandatory = $true)][string]$MysqldumpExe,
  [Parameter(Mandatory = $true)][string]$EnvFile,
  [Parameter(Mandatory = $true)][string]$CaPem,
  [Parameter(Mandatory = $true)][string]$Target,
  # Folder plugin klien (mis. caching_sha2_password), boleh kosong.
  [string]$PluginDir
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Output "GALAT: backend\.env tidak ditemukan: $EnvFile"
  exit 1
}
if (-not (Test-Path -LiteralPath $CaPem)) {
  Write-Output "GALAT: Sertifikat CA Aiven tidak ditemukan: $CaPem"
  exit 1
}
if (-not (Test-Path -LiteralPath $MysqldumpExe)) {
  Write-Output "GALAT: mysqldump.exe tidak ditemukan: $MysqldumpExe"
  exit 1
}

# Ambil nilai DATABASE_URL dari .env (dukung nilai berkutip). Hanya baris yang
# pertama dipakai, sama seperti dotenv.
$url = $null
foreach ($baris in (Get-Content -LiteralPath $EnvFile)) {
  if ($baris -match '^\s*DATABASE_URL\s*=\s*(.+?)\s*$') {
    $nilai = $Matches[1]
    if ($nilai.StartsWith('"') -and $nilai.EndsWith('"') -and $nilai.Length -ge 2) {
      $nilai = $nilai.Substring(1, $nilai.Length - 2)
    }
    $url = $nilai
    break
  }
}

if (-not $url -or -not ($url -match 'mysql://' -and $url -match 'aivencloud\.com')) {
  Write-Output 'DATABASE_URL di backend\.env tidak menunjuk Aiven - dump awan tidak dijalankan.'
  exit 1
}

$u = [System.Uri]$url
$namaDb = $u.AbsolutePath.Trim('/')
if (-not $namaDb) {
  Write-Output 'GALAT: nama database kosong di DATABASE_URL.'
  exit 1
}

# user:pass sebelum @, keduanya didekode dari bentuk URL.
$infoUser = [System.Net.WebUtility]::UrlDecode($u.UserInfo)
$posisiKoma = $infoUser.IndexOf(':')
if ($posisiKoma -lt 0) {
  $user = $infoUser
  $pass = ''
} else {
  $user = $infoUser.Substring(0, $posisiKoma)
  $pass = $infoUser.Substring($posisiKoma + 1)
}

if (-not $user) {
  Write-Output 'GALAT: username kosong di DATABASE_URL.'
  exit 1
}

# --single-transaction: konsisten tanpa mengunci tabel InnoDB.
# Opsi TLS tergantung varian klien mysqldump:
#   - MySQL 8:  --ssl-mode=VERIFY_IDENTITY + --ssl-ca, dan --set-gtid-purged=OFF
#     (Aiven menyalakan GTID; tanpa ini mysqldump meminta hak Super/GTID yang
#     tidak diberikan ke user aplikasi)
#   - MariaDB:  opsi --ssl-mode / --set-gtid-purged tidak ada; pakai
#     --ssl-ca + --ssl-verify-server-cert
# CA memakai berkas prisma/aiven-ca.pem (sertifikat CA publik, bukan rahasia).
$versi = (& $MysqldumpExe --version) | Out-String
if ($versi -match 'MariaDB') {
  $argOpsiEkstra = @("--ssl-ca=$CaPem", '--ssl-verify-server-cert')
} else {
  $argOpsiEkstra = @('--ssl-mode=VERIFY_IDENTITY', "--ssl-ca=$CaPem", '--set-gtid-purged=OFF')
}

$argSemua = @(
  "--host=$($u.Host)", "--port=$($u.Port)", "--user=$user", "--password=$pass"
)
if ($PluginDir) { $argSemua += "--plugin-dir=$PluginDir" }
$argSemua += $argOpsiEkstra + @(
  '--single-transaction', '--routines', '--triggers', '--events',
  '--default-character-set=utf8mb4', "--result-file=$Target", $namaDb
)

& $MysqldumpExe @argSemua

if ($LASTEXITCODE -ne 0) {
  Write-Output "GALAT: mysqldump ke Aiven gagal (exit $LASTEXITCODE). host=$($u.Host) db=$namaDb"
  exit 1
}

Write-Output "Dump Aiven selesai: host=$($u.Host) db=$namaDb -> $Target"
exit 0
