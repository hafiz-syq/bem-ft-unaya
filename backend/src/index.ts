import app from './app';
import { startAccountLifecycleJob } from './services/account-lifecycle.service';
import { startPemantauanCors } from './services/cors-monitor.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 BEM-FT UNAYA API Server Started`);
  console.log(`🌐 URL   : http://localhost:${PORT}`);
  console.log(`🔧 ENV   : ${process.env.NODE_ENV}`);
  console.log(`========================================\n`);
});

// Menjalankan pemeriksaan siklus hidup akun (nonaktif otomatis 5 tahun &
// hapus otomatis setelah nonaktif 1 tahun) tanpa perlu cron eksternal.
startAccountLifecycleJob();

// Menuliskan penolakan origin yang tertampung di memori ke audit log secara
// berkala, supaya admin bisa meninjau polanya dari dashboard.
startPemantauanCors();

import('./services/notifikasi-perpanjangan.service')
  .then(async ({ pemeriksaanPerpanjanganHarian }) => {
    const result = await pemeriksaanPerpanjanganHarian();
    console.log(
      `[notifikasi-perpanjangan] Pemeriksaan awal: ${result['30_hari']} akun dengan 30 hari lagi, ${result['7_hari']} akun dengan 7 hari lagi.`
    );
  })
  .catch((error) => {
    console.error('[notifikasi-perpanjangan] Gagal pemeriksaan awal:', error);
  });