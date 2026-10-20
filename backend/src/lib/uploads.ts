import fs from 'fs';
import path from 'path';

/**
 * Satu sumber kebenaran folder penyimpanan berkas unggahan.
 *
 * Default-nya `backend/uploads` seperti sebelumnya. Di server produksi setel
 * `UPLOAD_DIR` ke folder persisten (mis. `/var/lib/bem-ft/uploads`) supaya foto
 * profil, cover CMS, dan lampiran tiket tidak hilang saat aplikasi di-deploy
 * ulang atau container dibuat baru — filesystem container bersifat sementara.
 *
 * Nilainya dibaca saat fungsi dipanggil, bukan saat modul dimuat, agar isi
 * `.env` sudah tersedia pada semua jalur (server, skrip CLI, pengujian).
 */
export const folderUploads = (): string =>
  process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, '../../uploads');

/** Folder uploads yang dijamin sudah ada. */
export const pastikanFolderUploads = (): string => {
  const folder = folderUploads();
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
};
