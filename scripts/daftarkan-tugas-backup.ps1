# Mendaftarkan (ulang) tugas backup harian di Windows Task Scheduler.
#
# Pakai skrip ini setelah instal ulang Windows, pindah PC, atau bila ingin
# memastikan opsi tugasnya sama dengan yang dijelaskan di README:
#
#   powershell -ExecutionPolicy Bypass -File scripts\daftarkan-tugas-backup.ps1
#
# Opsi penting:
#   - Daily 03:00
#   - StartWhenAvailable: jadwal yang terlewat (PC mati pada 03:00) dijalankan
#     sesegera mungkin setelah PC menyala.
#   - Boleh jalan saat memakai baterai dan tidak dihentikan saat charger dicabut,
#     supaya laptop yang menyala tanpa charger tidak melewatkan backup.
#   - MultipleInstances IgnoreNew: tidak ada dua dump bersamaan.
#
# Tidak perlu administrator: tugas didaftarkan untuk pengguna yang sedang login.

$ErrorActionPreference = 'Stop'

$nama  = 'BEM FT - Backup Database Harian'
$skrip = Join-Path $PSScriptRoot 'backup-database.bat'

if (-not (Test-Path -LiteralPath $skrip)) {
    throw "Tidak menemukan skrip backup: $skrip"
}

$aksi   = New-ScheduledTaskAction -Execute $skrip
$pemicu = New-ScheduledTaskTrigger -Daily -At '03:00'
$opsi   = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $nama `
    -Action $aksi `
    -Trigger $pemicu `
    -Settings $opsi `
    -Description 'Dump MySQL bem_ft_unaya ke backups/*.zip setiap 03:00. Jadwal yang terlewat dijalankan begitu PC menyala.' `
    -Force | Out-Null

$t = Get-ScheduledTask -TaskName $nama
$i = Get-ScheduledTaskInfo -TaskName $nama
"Tugas terdaftar: {0} (state {1})" -f $t.TaskName, $t.State
"  Jadwal berikutnya : {0}" -f $i.NextRunTime
"  StartWhenAvailable: {0}" -f $t.Settings.StartWhenAvailable
"  Jalan saat baterai: {0}" -f (-not $t.Settings.DisallowStartIfOnBatteries)
