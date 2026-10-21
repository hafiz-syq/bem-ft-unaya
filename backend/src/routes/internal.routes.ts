import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { runAccountLifecycleJob } from '../services/account-lifecycle.service';
import { pemeriksaanPerpanjanganHarian } from '../services/notifikasi-perpanjangan.service';
import { flushPenolakanCors } from '../services/cors-monitor.service';

/**
 * Endpoint untuk cron Hostinger.
 *
 * Di shared hosting, proses Node bisa dihentikan saat tidak ada trafik
 * (on-demand). Timer `setInterval` di index.ts karenanya tidak bisa diandalkan
 * untuk job harian. Cron hPanel memanggil endpoint ini secara berkala, dan
 * `RUN_STARTUP_JOBS=0` mematikan job saat cold start supaya email peringatan
 * tidak terkirim berkali-kali setiap aplikasi dibangunkan.
 *
 * Endpoint ini tidak dapat dipakai tanpa CRON_SECRET. Bila CRON_SECRET kosong,
 * semua permintaan tetap ditolak 401 supaya tidak menjadi pintu terbuka dan
 * perilakunya sama di semua lingkungan (termasuk CI yang tidak punya secret).
 */

const router = Router();

const secretSama = (diberikan: string | undefined, diharapkan: string): boolean => {
  if (!diberikan) return false;
  const a = Buffer.from(diberikan);
  const b = Buffer.from(diharapkan);
  return a.length === b.length && timingSafeEqual(a, b);
};

router.post('/cron', async (req: Request, res: Response) => {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || !secretSama(req.get('x-cron-secret'), secret)) {
    res.status(401).json({ message: 'Kunci cron tidak sah.' });
    return;
  }

  let gagal = false;

  let siklusAkun: { dinonaktifkan: number; dihapus: number; dipulihkan: number; gagal: number } | null =
    null;
  try {
    const hasil = await runAccountLifecycleJob();
    siklusAkun = {
      dinonaktifkan: hasil.dinonaktifkan,
      dihapus: hasil.dihapus,
      dipulihkan: hasil.dipulihkan,
      gagal: hasil.gagal.length,
    };
  } catch (error) {
    gagal = true;
    console.error('[cron] Siklus akun gagal:', error);
  }

  let perpanjangan: Record<string, number> | null = null;
  try {
    perpanjangan = await pemeriksaanPerpanjanganHarian();
  } catch (error) {
    gagal = true;
    console.error('[cron] Notifikasi perpanjangan gagal:', error);
  }

  let corsTertulis = 0;
  try {
    corsTertulis = await flushPenolakanCors();
  } catch (error) {
    gagal = true;
    console.error('[cron] Penulisan catatan CORS gagal:', error);
  }

  // Balasan sengaja hanya berisi angka agregat: tidak ada NIM, email, atau
  // detail akun yang keluar lewat endpoint ini.
  res.status(gagal ? 500 : 200).json({
    ok: !gagal,
    siklusAkun,
    perpanjangan,
    corsTertulis,
    dijalankanPada: new Date().toISOString(),
  });
});

export default router;
