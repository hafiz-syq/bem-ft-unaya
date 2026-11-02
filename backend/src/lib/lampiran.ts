import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { pastikanFolderUploads } from './uploads';
import { cloudinarySiap, hapusDariCloudinary, unggahKeCloudinary } from './cloudinary';

/**
 * Penyimpanan lampiran tiket (gambar/PDF) dan arsip dokumen kantor.
 *
 * Sebelumnya berkas ditulis ke folder `uploads` di disk. Di Vercel folder itu
 * bersifat sementara (`/tmp`), sehingga URL `/uploads/...` yang tersimpan di
 * database tetap ada tetapi berkasnya hilang setelah instance dingin — sama
 * seperti masalah galeri dan foto profil yang kini sudah ke Cloudinary.
 *
 * Aturan sekarang (sama seperti gambar-media.ts):
 * - Bila Cloudinary dikonfigurasi (produksi/Vercel):
 *   - gambar  -> dikonversi WebP lalu diunggah ke Cloudinary (resource image)
 *   - PDF     -> diunggah apa adanya (resource raw)
 *   - dokumen -> PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX disimpan apa adanya (raw)
 *   dan database menyimpan URL lengkap `https://res.cloudinary.com/...`.
 * - Bila tidak (pengembangan lokal tanpa kredensial), berkas ditulis ke folder
 *   `uploads` seperti sebelumnya agar fitur tetap bisa dicoba.
 *
 * URL lama berbentuk `/uploads/<berkas>` (data sebelum migrasi) tetap didukung
 * pada penghapusan: berkasnya dibuang dari disk bila masih ada.
 */

const FOLDER_LAMPIRAN = 'bem-ft-unaya/attachments';
const FOLDER_DOKUMEN = 'bem-ft-unaya/documents';

export interface HasilLampiran {
  /** Nama yang ditampilkan/tersimpan di database (mis. nama asli berkas). */
  filename: string;
  /** URL Cloudinary (absolut) atau path `/uploads/...` pada cadangan lokal. */
  url: string;
  mimeType: string;
  size: number;
}

const unik = (): string => `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

/** Mengubah isi berkas gambar menjadi WebP berukuran wajar (lampiran cukup 1600px). */
const keWebp = (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer, { failOn: 'none', limitInputPixels: 60_000_000 })
    .rotate() // menghormati orientasi EXIF dari kamera HP
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

const galatLampiran = (message: string, statusCode = 502): Error => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * Verifikasi isi berkas dokumen dengan tanda tangan (magic bytes).
 *
 * Filter MIME Multer bergantung pada header dari browser dan mudah dipalsukan;
 * karena itu isi yang nyata diperiksa di sini sebelum berkas disimpan: PDF mulai dengan
 * `%PDF-`, format Office modern (DOCX/XLSX/PPTX) dengan tanda ZIP `PK`, dan
 * Office lama (DOC/XLS/PPT) dengan tanda OLE `D0 CF 11 E0`.
 */
const pastikanIsiDokumenSah = (isi: Buffer, mimetype: string): void => {
  const isPdf = isi.length >= 5 && isi.toString('binary', 0, 5) === '%PDF-';
  const isZip =
    isi.length >= 4 && isi[0] === 0x50 && isi[1] === 0x4b && (isi[2] === 0x03 || isi[2] === 0x05 || isi[2] === 0x07);
  const isOle =
    isi.length >= 8 &&
    isi[0] === 0xd0 && isi[1] === 0xcf && isi[2] === 0x11 && isi[3] === 0xe0 &&
    isi[4] === 0xa1 && isi[5] === 0xb1 && isi[6] === 0x1a && isi[7] === 0xe1;

  const sah = mimetype === 'application/pdf' ? isPdf : isZip || isOle || isPdf;
  if (!sah) {
    throw galatLampiran(
      'Isi berkas tidak cocok dengan formatnya. Pastikan PDF/DOC/XLS/PPT berasal dari berkas asli, bukan berkas yang diganti namanya.',
      400
    );
  }
};

/** Membaca isi unggahan dari memori (Vercel) maupun dari disk (multer disk). */
const bacaIsiFile = async (file: Express.Multer.File): Promise<Buffer | null> => {
  const isi = file.buffer ?? (file.path ? await fs.promises.readFile(file.path) : null);
  return isi?.length ? isi : null;
};

/** Cadangan lokal: tulis berkas ke folder uploads, balas path `/uploads/...`. */
const simpanLokal = async (isi: Buffer, nama: string, mimeType: string): Promise<HasilLampiran> => {
  const folder = pastikanFolderUploads();
  await fs.promises.writeFile(path.join(folder, nama), isi);
  return { filename: nama, url: `/uploads/${nama}`, mimeType, size: isi.length };
};

export const simpanLampiran = async (file: Express.Multer.File): Promise<HasilLampiran> => {
  const isi = await bacaIsiFile(file);
  if (!isi) throw galatLampiran('Berkas lampiran tidak terbaca. Silakan pilih ulang berkasnya.', 400);

  const gambar = file.mimetype.startsWith('image/');
  let nama = file.originalname ?? 'lampiran';

  if (gambar) {
    // Middleware denganWebp biasa sudah mengubah buffer menjadi WebP. Bila
    // isinya sudah WebP (isi dan ekstensi saling cocok), jangan dikode ulang
    // supaya kualitas tidak turun berulang kali.
    const sudahWebp = file.mimetype === 'image/webp' && path.extname(nama).toLowerCase() === '.webp';
    let webp: Buffer;
    if (sudahWebp) {
      webp = isi;
    } else {
      try {
        webp = await keWebp(isi);
      } catch {
        throw galatLampiran(
          `Gambar "${nama}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`,
          400
        );
      }
    }
    nama = `${path.parse(nama).name || 'lampiran'}-${unik()}`;
    if (cloudinarySiap()) {
      const { secureUrl } = await unggahKeCloudinary(webp, {
        folder: FOLDER_LAMPIRAN,
        publicId: `${FOLDER_LAMPIRAN}/${nama}`,
        format: 'webp',
      });
      return { filename: `${nama}.webp`, url: secureUrl, mimeType: 'image/webp', size: webp.length };
    }
    nama = `${nama}.webp`;
    return simpanLokal(webp, nama, 'image/webp');
  }

  // PDF dan berkas lain disimpan apa adanya (resource raw). Ekstensi
  // aslinya dipertahankan supaya unduhan memilik nama yang benar.
  pastikanIsiDokumenSah(isi, file.mimetype || 'application/pdf');
  const ekstensi = path.extname(nama) || '.pdf';
  nama = `TICKET-${unik()}${ekstensi}`;
  if (cloudinarySiap()) {
    const { secureUrl } = await unggahKeCloudinary(isi, {
      folder: FOLDER_LAMPIRAN,
      publicId: `${FOLDER_LAMPIRAN}/${path.parse(nama).name}`,
      resourceType: 'raw',
    });
    return { filename: nama, url: secureUrl, mimeType: file.mimetype || 'application/pdf', size: isi.length };
  }
  return simpanLokal(isi, nama, file.mimetype || 'application/pdf');
};

export const simpanDokumenArsip = async (file: Express.Multer.File): Promise<HasilLampiran> => {
  const isi = await bacaIsiFile(file);
  if (!isi) throw galatLampiran('Berkas dokumen tidak terbaca. Silakan pilih ulang berkasnya.', 400);

  pastikanIsiDokumenSah(isi, file.mimetype || 'application/pdf');
  const ekstensi = (path.extname(file.originalname || '') || '.pdf').toLowerCase();
  const nama = `DOKUMEN-${unik()}${ekstensi}`;
  if (cloudinarySiap()) {
    const { secureUrl } = await unggahKeCloudinary(isi, {
      folder: FOLDER_DOKUMEN,
      publicId: `${FOLDER_DOKUMEN}/${path.parse(nama).name}`,
      resourceType: 'raw',
    });
    return {
      filename: nama,
      url: secureUrl,
      mimeType: file.mimetype || 'application/pdf',
      size: isi.length,
    };
  }
  return simpanLokal(isi, nama, file.mimetype || 'application/pdf');
};

/**
 * Menghapus lampiran yang tidak lagi dipakai. URL Cloudinary dihapus dari
 * Cloudinary (mengikuti jenis resource dari URL); path `/uploads/...` lama
 * dihapus dari folder uploads. Kegagalan diabaikan: data database sudah
 * terhapus, jadi berkas yatim tidak boleh membuat operasi gagal.
 */
export const hapusLampiran = async (url: string | null | undefined): Promise<void> => {
  if (!url) return;

  if (url.startsWith('/uploads/')) {
    const berkas = path.join(pastikanFolderUploads(), path.basename(url));
    await fs.promises.unlink(berkas).catch(() => undefined);
    return;
  }

  if (/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    await hapusDariCloudinary(url);
  }
};
