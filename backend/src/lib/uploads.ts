import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Satu sumber kebenaran folder penyimpanan berkas unggahan.
 *
 * Default-nya `backend/uploads` seperti sebelumnya. Di server produksi setel
 * `UPLOAD_DIR` ke folder persisten (mis. `/var/lib/bem-ft/uploads`) supaya foto
 * profil, cover CMS, dan lampiran tiket tidak hilang saat aplikasi di-deploy
 * ulang atau container dibuat baru — filesystem container bersifat sementara.
 *
 * Di Vercel (serverless) bundle di `/var/task` bersifat read-only: mencoba
 * membuat folder di sana membuat setiap unggahan gagal dengan ENOENT. Karena
 * itu, tanpa `UPLOAD_DIR`, berkas ditulis ke `/tmp` — satu-satunya folder yang
 * bisa ditulis di sana. `/tmp` juga sementara (hilang saat instance dingin),
 * jadi untuk penyimpanan permanen di Vercel tetap diperlukan object storage
 * eksternal.
 *
 * Nilainya dibaca saat fungsi dipanggil, bukan saat modul dimuat, agar isi
 * `.env` sudah tersedia pada semua jalur (server, skrip CLI, pengujian).
 */
export const folderUploads = (): string => {
  if (process.env.UPLOAD_DIR) return path.resolve(process.env.UPLOAD_DIR);

  // VERCEL=1 disuntikkan otomatis oleh Vercel pada build dan runtime.
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'bem-ft-uploads');

  return path.join(__dirname, '../../uploads');
};

/** Folder uploads yang dijamin sudah ada. */
export const pastikanFolderUploads = (): string => {
  const folder = folderUploads();
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
};
