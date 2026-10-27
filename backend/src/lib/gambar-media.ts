import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { pastikanFolderUploads } from './uploads';
import { cloudinarySiap, unggahKeCloudinary } from './cloudinary';

/**
 * Penyimpanan gambar media (galeri & cover) supaya foto tidak hilang.
 *
 * Sebelumnya gambar ditulis ke folder `uploads` di disk. Di Vercel folder itu
 * bersifat sementara (`/tmp`), sehingga URL `/uploads/...` yang tersimpan di
 * database tetap ada tetapi berkasnya hilang setelah instance dingin — inilah
 * penyebab foto galeri tidak muncul di halaman publik.
 *
 * Aturan sekarang:
 * - Bila Cloudinary dikonfigurasi (produksi/Vercel), gambar diunggah ke sana
 *   dan database menyimpan URL lengkap `https://res.cloudinary.com/...`.
 * - Bila tidak (mis. pengembangan lokal tanpa kredensial), gambar tetap
 *   disimpan ke folder `uploads` seperti sebelumnya agar fitur bisa dicoba.
 */

const FOLDER_GALERI = 'bem-ft-unaya/gallery';

/** Batas dimensi gambar media; foto galeri cukup 1600px sisi terpanjang. */
const SISI_MAKSIMAL = 1600;

/** Mengubah isi berkas gambar menjadi WebP berukuran wajar. */
const keWebp = (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer, {
    failOn: 'none',
    limitInputPixels: 60_000_000,
  })
    .rotate()
    .resize({ width: SISI_MAKSIMAL, height: SISI_MAKSIMAL, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

/**
 * Menyimpan satu berkas gambar unggahan dan mengembalikan URL yang siap dipakai
 * di `<img src>`. Nilai yang dikembalikan bisa berupa URL Cloudinary (absolut)
 * atau path `/uploads/...` saat Cloudinary tidak tersedia.
 */
export const simpanGambarMedia = async (
  file: Express.Multer.File,
  folder: string = FOLDER_GALERI
): Promise<string> => {
  const sumber = file.buffer ?? (file.path ? await fs.promises.readFile(file.path) : null);
  if (!sumber?.length) {
    const err: any = new Error('Berkas gambar tidak terbaca. Silakan pilih ulang fotonya.');
    err.statusCode = 400;
    throw err;
  }

  let webp: Buffer;
  try {
    webp = await keWebp(sumber);
  } catch {
    const err: any = new Error(
      `Gambar "${file.originalname ?? 'yang diunggah'}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`
    );
    err.statusCode = 400;
    throw err;
  }

  if (cloudinarySiap()) {
    const { secureUrl } = await unggahKeCloudinary(webp, {
      folder,
      publicId: `GALERI-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      format: 'webp',
    });
    return secureUrl;
  }

  // Cadangan lokal (tanpa Cloudinary): tetap simpan ke folder uploads.
  const folderLokal = pastikanFolderUploads();
  const nama = `GALERI-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  await fs.promises.writeFile(path.join(folderLokal, nama), webp);
  return `/uploads/${nama}`;
};

/**
 * Menghapus gambar media yang tidak lagi dipakai.
 * URL Cloudinary dihapus dari Cloudinary; path lokal dihapus dari folder uploads.
 */
export const hapusGambarMedia = async (url: string | null | undefined): Promise<void> => {
  if (!url) return;

  if (url.startsWith('/uploads/')) {
    const berkas = path.join(pastikanFolderUploads(), path.basename(url));
    await fs.promises.unlink(berkas).catch(() => undefined);
    return;
  }

  if (/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    const { hapusDariCloudinary } = await import('./cloudinary');
    await hapusDariCloudinary(url);
  }
};
