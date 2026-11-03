import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
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

// Secret boleh dibawa empat cara: header x-cron-secret (GitHub Actions/curl),
// header `Authorization: Bearer ...` yang dikirim otomatis oleh Vercel Cron bila
// proyek punya env CRON_SECRET, query ?secret=..., atau segmen path
// /cron/<secret> (untuk pemanggil yang tidak bisa menyetel header sama sekali).
// Secret TIDAK pernah ditulis di vercel.json: path cron memakai bentuk bersih
// /api/internal/cron supaya nilainya hanya ada di environment Vercel.
// Didaftarkan sebagai rute-rute terpisah dengan nama segmen eksplisit supaya
// pemeriksa kelengkapan di src/tests/uji-akses-rute.ts (yang memindai sumber
// berkas dan membaca segmen pertama setiap pemanggilan pendaftaran rute)
// tetap mengenali semuanya. Jangan gabungkan dalam satu larik path.
const jalankanCron = async (req: Request, res: Response): Promise<void> => {
  const secret = (process.env.CRON_SECRET || '').trim();
  const kunciParam = req.params.kunciCron;
  const bearer = /^bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
  const dibawa =
    req.get('x-cron-secret') ||
    bearer ||
    (typeof kunciParam === 'string' ? kunciParam : undefined) ||
    (typeof req.query.secret === 'string' ? req.query.secret : undefined);
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

router.post('/cron', jalankanCron);
// Vercel Cron selalu mengirim GET; tanpa varian ini cron menjawab 404 diam-diam.
router.get('/cron', jalankanCron);
// Varian segmen path untuk pemanggil yang hanya bisa mengatur URL.
router.post('/cron/:kunciCron', jalankanCron);
router.get('/cron/:kunciCron', jalankanCron);

export default router;
