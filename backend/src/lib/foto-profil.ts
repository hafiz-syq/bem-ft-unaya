import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { folderUploads } from './uploads';
import { hapusDariCloudinary, unggahKeCloudinary } from './cloudinary';

/**
 * Satu tempat untuk menyimpan foto profil (foto pengguna).
 *
 * Foto diunggah ke Cloudinary dan database menyimpan URL lengkapnya. Ini
 * menggantikan penyimpanan di disk yang tidak bertahan di Vercel: setiap kali
 * instance serverless dingin atau aplikasi di-deploy ulang, berkas di `/tmp`
 * hilang sehingga foto profil tampak "menghilang".
 */

/** Folder induk di akun Cloudinary, supaya media proyek ini tidak tercampur. */
const FOLDER_FOTO_PROFIL = 'bem-ft-unaya/profiles';

/** Batas dimensi: foto profil tidak perlu lebih besar dari ini. */
const SISI_MAKSIMAL = 1024;

const galatFoto = (message: string, statusCode: number): Error => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/** Mengubah isi berkas gambar apa pun (JPG/PNG/HEIC/...) menjadi WebP kecil. */
export const ubahFotoKeWebp = (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer, {
    failOn: 'none',
    // Batasi piksel agar berkas kecil yang "meledak" saat didekode tidak
    // menghabiskan memori server. 60 MP masih cukup untuk foto kamera HP.
    limitInputPixels: 60_000_000,
  })
    .rotate() // menghormati orientasi EXIF dari kamera HP
    .resize({
      width: SISI_MAKSIMAL,
      height: SISI_MAKSIMAL,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

/**
 * Menyimpan foto profil yang baru diunggah dan mengembalikan URL publiknya.
 *
 * `req.file` dibuat oleh multer dengan penyimpanan memori, jadi tidak ada
 * berkas sementara yang perlu dibersihkan dan tidak ada penulisan ke disk.
 */
export const simpanFotoProfil = async (file: {
  buffer?: Buffer;
  originalname?: string;
}): Promise<string> => {
  if (!file?.buffer?.length) {
    throw galatFoto('Berkas foto tidak terbaca. Silakan pilih ulang fotonya.', 400);
  }

  let webp: Buffer;
  try {
    webp = await ubahFotoKeWebp(file.buffer);
  } catch {
    throw galatFoto(
      `Gambar "${file.originalname ?? 'yang diunggah'}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`,
      400
    );
  }

  const { secureUrl } = await unggahKeCloudinary(webp, {
    folder: FOLDER_FOTO_PROFIL,
    publicId: `PROFILE-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    format: 'webp',
  });

  return secureUrl;
};

/**
 * Menghapus foto profil lama.
 *
 * Dua bentuk nilai didukung:
 * - URL Cloudinary (foto baru)  -> dihapus dari Cloudinary
 * - `/uploads/<berkas>` (foto lama sebelum Cloudinary) -> dihapus dari disk
 *
 * Kegagalan diabaikan: kolom database sudah dikosongkan, jadi pengguna tidak
 * boleh dibuat gagal hanya karena berkas lama tidak bisa dibuang.
 * `path.basename` dipakai agar nilai kolom yang aneh (mis. berisi `../`) tidak
 * bisa menghapus berkas lain.
 */
export const hapusFotoProfil = (foto: string | null | undefined): void => {
  if (!foto) return;

  if (foto.startsWith('/uploads/')) {
    const berkas = path.join(folderUploads(), path.basename(foto));
    fs.promises.unlink(berkas).catch(() => undefined);
    return;
  }

  if (/^https:\/\/res\.cloudinary\.com\//.test(foto)) {
    void hapusDariCloudinary(foto);
  }
};
