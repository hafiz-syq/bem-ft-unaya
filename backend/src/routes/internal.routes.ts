import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import { runAccountLifecycleJob } from '../services/account-lifecycle.service';
import { pemeriksaanPerpanjanganHarian } from '../services/notifikasi-perpanjangan.service';
import { flushPenolakanCors } from '../services/cors-monitor.service';
import { purgeExpiredTrash } from '../services/student-trash.service';
import { pangkasRetensi, HasilRetensi } from '../services/retensi.service';
import { kirimPengingatLaporanBulanan } from '../controllers/report.controller';

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

// Secret hanya boleh dibawa lewat header: `x-cron-secret` (GitHub Actions/curl)
// atau `Authorization: Bearer ...` yang dikirim otomatis oleh Vercel Cron bila
// proyek punya env CRON_SECRET. Bentuk query `?secret=...` dan segmen path
// `/cron/<secret>` sengaja DIHAPUS: keduanya menaruh secret di URL, yang
// tersimpan di log akses proxy/platform, riwayat browser, dan header Referer.
// Secret juga tidak pernah ditulis di vercel.json — path cron memakai bentuk
// bersih /api/internal/cron supaya nilainya hanya ada di environment Vercel.
const jalankanCron = async (req: Request, res: Response): Promise<void> => {
  const secret = (process.env.CRON_SECRET || '').trim();
  const bearer = /^bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
  const dibawa = req.get('x-cron-secret') || bearer;
  if (!secret || !secretSama(dibawa, secret)) {
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

  // Tempat sampah: akun dan pesan yang lewat 30 hari dimusnahkan permanen.
  let tempatSampah: { akun: number; pesan: number; gagal: number } | null = null;
  try {
    const hasil = await purgeExpiredTrash();
    tempatSampah = { akun: hasil.akun, pesan: hasil.pesan, gagal: hasil.gagal.length };
  } catch (error) {
    gagal = true;
    console.error('[cron] Pembersihan tempat sampah gagal:', error);
  }

  // Retensi log & jejak tamu. Mati kecuali RETENSI_AKTIF=1, jadi cron harian
  // hari ini tidak menghapus apa pun; lihat ambangnya di retensi.service.ts.
  let retensi: HasilRetensi | null = null;
  try {
    retensi = await pangkasRetensi();
  } catch (error) {
    gagal = true;
    console.error('[cron] Retensi log gagal:', error);
  }

  // Pengingat laporan bulanan pada tanggal 1 (sekali per bulan).
  let pengingatLaporan = false;
  try {
    pengingatLaporan = await kirimPengingatLaporanBulanan();
  } catch (error) {
    gagal = true;
    console.error('[cron] Pengingat laporan bulanan gagal:', error);
  }

  // Balasan sengaja hanya berisi angka agregat: tidak ada NIM, email, atau
  // detail akun yang keluar lewat endpoint ini.
  res.status(gagal ? 500 : 200).json({
    ok: !gagal,
    siklusAkun,
    perpanjangan,
    corsTertulis,
    tempatSampah,
    retensi,
    pengingatLaporan,
    dijalankanPada: new Date().toISOString(),
  });
};

// Kunci hanya lewat header, jadi sisa risikonya tebak-tebakan dari sisi IP.
// Pemanggil sah (Vercel Cron) datang sekali sehari; 10 percobaan per 15 menit
// per IP masih longgar untuk restart/manual tetapi menghentikan penebakan.
const batasCron = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Terlalu banyak percobaan cron dari alamat ini.' },
});

router.post('/cron', batasCron, jalankanCron);
// Vercel Cron selalu mengirim GET; tanpa varian ini cron menjawab 404 diam-diam.
router.get('/cron', batasCron, jalankanCron);

export default router;
