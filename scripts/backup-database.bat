@echo off
setlocal EnableExtensions

rem ============================================================
rem  BACKUP OTOMATIS DATABASE BEM FT UNAYA
rem  ----------------------------------------------------------
rem  Skrip: scripts\backup-database.bat
rem  Dump : bem_ft_unaya -> backups\bem_ft_unaya_TGL.sql
rem  Rotasi: berkas lebih tua dari HARI_SIMPAN dihapus.
rem
rem  Dijalankan manual:
rem     scripts\backup-database.bat
rem
rem  Dijadwalkan harian (sudah terdaftar, lihat catatan di bawah):
rem     schtasks /Query /TN "BEM FT - Backup Database Harian"
rem
rem  Menimpa lokasi mysqldump secara manual (mis. versi berbeda):
rem     set MYSQLDUMP_EXE=C:\xampp\mysql\bin\mysqldump.exe
rem     scripts\backup-database.bat
rem ============================================================

rem ---- Konfigurasi -------------------------------------------
set "DB_NAME=bem_ft_unaya"
set "DB_HOST=localhost"
set "DB_PORT=3306"
set "DB_USER=root"
set "DB_PASS="
set "JALUR_APLIKASI=D:\Coding Apis\bem-ft-unaya"
set "FOLDER_BACKUP=%JALUR_APLIKASI%\backups"
set "LOG=%FOLDER_BACKUP%\backup.log"
set "HARI_SIMPAN=14"

if not exist "%FOLDER_BACKUP%" mkdir "%FOLDER_BACKUP%"

rem ---- Lokasi mysqldump.exe ----------------------------------
rem Diperiksa dari cukup banyak tempat; tambahkan baris kandidat bila
rem MySQL Anda terpasang di lokasi lain.
if not defined MYSQLDUMP_EXE (
  for %%D in (
    "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqldump.exe"
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe"
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
    "C:\xampp\mysql\bin\mysqldump.exe"
  ) do if exist %%D set "MYSQLDUMP_EXE=%%~D"
)
if not defined MYSQLDUMP_EXE (
  echo [%date% %time%] GALAT: mysqldump.exe tidak ditemukan. Setel variabel MYSQLDUMP_EXE atau perbarui daftar kandidat.>> "%LOG%"
  exit /b 1
)

rem ---- Folder plugin klien (caching_sha2_password) ------------
rem MySQL 8 menyimpan password dengan plugin caching_sha2_password dan klien
rem mysqldump memerlukan DLL-nya. Distribusi MySQL hasil pangkas (mis. Laragon
rem lite) tidak menyertakan lib\plugin, sehingga dump gagal dengan galat 1156.
rem DLL itu biasanya masih ada di folder plugin HeidiSQL — arahkan ke sana.
set "ARG_PLUGIN="
if exist "C:\laragon\bin\heidisql\plugins\caching_sha2_password.dll" (
  set "ARG_PLUGIN=--plugin-dir=C:\laragon\bin\heidisql\plugins"
) else if exist "C:\Program Files\MySQL\MySQL Server 8.4\lib\plugin\caching_sha2_password.dll" (
  set "ARG_PLUGIN=--plugin-dir=C:\Program Files\MySQL\MySQL Server 8.4\lib\plugin"
) else if exist "C:\Program Files\MySQL\MySQL Server 8.0\lib\plugin\caching_sha2_password.dll" (
  set "ARG_PLUGIN=--plugin-dir=C:\Program Files\MySQL\MySQL Server 8.0\lib\plugin"
)

rem ---- Penanda waktu (aman dari format tanggal lokal) ---------
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%t"

set "TARGET=%FOLDER_BACKUP%\%DB_NAME%_%STAMP%.sql"

rem ---- Dump database ------------------------------------------
rem --single-transaction memakai InnoDB agar dump tidak mengunci tabel dan
rem tetap konsisten meski aplikasi sedang dipakai. Tanda --- berurutan itu
rem membaca database dalam satu moment yang sama.
"%MYSQLDUMP_EXE%" --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% --password=%DB_PASS% %ARG_PLUGIN% --single-transaction --routines --triggers --events --default-character-set=utf8mb4 --result-file="%TARGET%" %DB_NAME% 2>>"%LOG%"

if errorlevel 1 goto :gagal

rem ---- Validasi hasil -----------------------------------------
rem Dump sehat minimal harus > 1 KB (database kosong pun lebih besar dari itu
rem karena memuat DDL seluruh tabel).
for %%F in ("%TARGET%") do set "UKURAN=%%~zF"
if %UKURAN% LSS 1024 goto :gagal

rem ---- Rotasi: hapus berkas lebih tua dari HARI_SIMPAN --------
forfiles /P "%FOLDER_BACKUP%" /M %DB_NAME%_*.sql /D -%HARI_SIMPAN% /C "cmd /c if @isdir equ FALSE del /f @path" 2>NUL

echo [%date% %time%] SUKSES: %TARGET% (%UKURAN% byte)>> "%LOG%"
exit /b 0

:gagal
echo [%date% %time%] GALAT: dump gagal atau berkas terlalu kecil untuk %DB_NAME%@%DB_HOST%. Lihat pesan di atas.>> "%LOG%"
rem ---- Peringatan email bila SMTP tersedia --------------------
rem Helper memakai SMTP dari backend\.env; selalu exit 0 walau kirim gagal.
node "%JALUR_APLIKASI%\backend\scripts\peringatan-backup.cjs" GAGAL "%TARGET%" 2>NUL
if exist "%TARGET%" del /f "%TARGET%" 2>NUL
exit /b 1
