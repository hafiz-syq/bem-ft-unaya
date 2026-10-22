import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { pastikanFolderUploads } from '../lib/uploads';

// Satu sumber kebenaran untuk batas ukuran unggahan.
// app.ts memakainya juga agar pesan error ukuran file selalu sinkron dengan konfigurasi di sini.
export const UPLOAD_LIMITS = {
  foto: 2 * 1024 * 1024, // foto profil (login pertama)
  file: 5 * 1024 * 1024, // lampiran tiket & CMS
  pdfImpor: 10 * 1024 * 1024, // KHUSUS untuk impor data mahasiswa
} as const;

// Error validasi unggahan adalah kesalahan INPUT PENGGUNA, bukan kegagalan server.
// Properti statusCode ini dibaca oleh Global Error Handler di app.ts agar balasannya 400, bukan 500.
const uploadError = (message: string): Error => {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
};

// Konfigurasi penyimpanan
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, pastikanFolderUploads());
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'TICKET-' + uniqueSuffix + ext);
  }
});

// Filter tipe file: semua GAMBAR (kecuali SVG) + PDF.
// Gambar non-WebP akan dikonversi setelah multer selesai menyimpannya.
// SVG sengaja ditolak: berkas itu bisa memuat skrip, bukan sekadar gambar.
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const gambar = file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml';
  if (gambar || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(uploadError('Format file tidak didukung. Gunakan gambar (JPG, PNG, WEBP, HEIC, GIF, dst.) atau PDF.'));
  }
};

export const uploadAttachment = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: UPLOAD_LIMITS.file } // Maksimal 5 MB
});

// --- Khusus foto profil (dipakai saat login pertama) ---
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, pastikanFolderUploads());
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'PROFILE-' + uniqueSuffix + ext);
  }
});

// Foto profil hanya menerima gambar (tanpa PDF). Semua format gambar yang
// dikenali sharp (JPG, PNG, WEBP, HEIC, GIF, AVIF, TIFF) diterima.
const photoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
    cb(null, true);
  } else {
    cb(uploadError('Format foto tidak didukung. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).'));
  }
};

export const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.foto } // Maksimal 2 MB
});

// Foto profil pengguna disimpan di Cloudinary, jadi isinya cukup ditahan di
// memori sampai selesai diunggah. Tidak ada berkas yang ditulis ke disk: di
// Vercel filesystem bersifat read-only dan `/tmp` hilang setiap instance baru,
// yang membuat foto profil sebelumnya tampak menghilang.
export const uploadFotoMemori = multer({
  storage: multer.memoryStorage(),
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.foto } // Maksimal 2 MB
});

// ================= KONVERSI GAMBAR KE WEBP =================
// Semua unggahan gambar selain WebP diproses ulang menjadi WebP supaya ukuran
// transfer lebih kecil. Foto yang sudah WebP dibiarkan apa adanya (tidak
// dikompresi ulang) agar kualitasnya tidak turun berulang kali.
//
// PDF tidak disentuh: hanya lampiran tiket yang boleh PDF.
const kumpulanFile = (req: any): Express.Multer.File[] => {
  const hasil: Express.Multer.File[] = [];
  if (req.file) hasil.push(req.file);

  const files = req.files;
  if (Array.isArray(files)) {
    hasil.push(...files);
  } else if (files && typeof files === 'object') {
    for (const daftar of Object.values(files)) {
      if (Array.isArray(daftar)) hasil.push(...daftar);
    }
  }

  return hasil;
};

const hapusFile = async (file: Express.Multer.File): Promise<void> => {
  if (!file?.path) return;
  await fs.promises.unlink(file.path).catch(() => undefined);
};

const konversiSatuGambar = async (file: Express.Multer.File): Promise<void> => {
  const folder = file.destination || path.dirname(file.path);
  const dasar = path.parse(file.filename).name;
  const tujuan = path.join(folder, `${dasar}.webp`);

  // Bila nama berkas sudah berakhiran .webp tetapi isinya bukan WebP, jangan
  // menulis ke berkas yang sedang dibaca sharp. Pakai berkas sementara dulu.
  const sementara = path.resolve(tujuan) === path.resolve(file.path)
    ? path.join(folder, `${dasar}.konversi.webp`)
    : tujuan;

  try {
    await sharp(file.path, {
      failOn: 'none',
      // Batasi piksel agar berkas kecil yang "meledak" saat didekode tidak
      // menghabiskan memori server. 60 MP masih cukup untuk foto kamera HP.
      limitInputPixels: 60_000_000,
    })
      .rotate() // menghormati orientasi EXIF dari kamera HP
      .webp({ quality: 82, effort: 4 })
      .toFile(sementara);

    if (sementara !== tujuan) {
      await fs.promises.rename(sementara, tujuan);
    }

    if (path.resolve(tujuan) !== path.resolve(file.path)) {
      await fs.promises.unlink(file.path).catch(() => undefined);
    }

    const stat = await fs.promises.stat(tujuan);
    file.path = tujuan;
    file.filename = path.basename(tujuan);
    file.destination = folder;
    file.mimetype = 'image/webp';
    file.size = stat.size;
    file.originalname = `${path.parse(file.originalname).name}.webp`;
  } catch {
    // Bersihkan berkas sementara/target yang mungkin sudah setengah tertulis.
    await fs.promises.unlink(sementara).catch(() => undefined);
    if (sementara !== tujuan) await fs.promises.unlink(tujuan).catch(() => undefined);
    throw uploadError(`Gambar "${file.originalname}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`);
  }
};

export const konversiGambarKeWebp = async (req: any, res: any, next: any): Promise<void> => {
  const files = kumpulanFile(req);

  for (const file of files) {
    if (!file.path) continue;
    if (!file.mimetype?.startsWith('image/')) continue;

    // Lewati hanya bila isi DAN ekstensinya benar-benar WebP. Berkas WebP yang
    // diunggah dengan nama .jpg tetap dinormalkan agar Content-Type saat
    // disajikan tidak menyesatkan browser.
    const sudahWebp = file.mimetype === 'image/webp' && path.extname(file.filename).toLowerCase() === '.webp';
    if (sudahWebp) continue;

    try {
      await konversiSatuGambar(file);
    } catch (error) {
      // Jangan tinggalkan sebagian berkas di folder unggahan bila satu gambar
      // gagal diproses: pengguna harus mengulang seluruh unggahan.
      await Promise.all(files.map(hapusFile));
      next(error);
      return;
    }
  }

  next();
};

/** Membungkus multer agar setiap gambar yang tersimpan langsung menjadi WebP. */
export const denganWebp = (unggah: multer.Multer) => ({
  single: (field: string) => [unggah.single(field), konversiGambarKeWebp],
  fields: (fields: any) => [unggah.fields(fields), konversiGambarKeWebp],
});

// --- Khusus berkas PDF impor data mahasiswa ---
// Isinya hanya dibaca sekali untuk diproses, jadi disimpan di memori dan tidak
// pernah menyentuh disk: dengan begitu tidak ada berkas sementara yang perlu
// dibersihkan setelah proses selesai (berhasil maupun gagal).
const pdfFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(uploadError('Berkas impor harus berupa PDF.'));
  }
};

export const uploadPdfImpor = multer({
  storage: multer.memoryStorage(),
  fileFilter: pdfFileFilter,
  // Nama field "file" dipakai agar pesan batas ukuran di app.ts menyebut angka
  // dari UPLOAD_LIMITS. Impor PDF punya batas sendiri (pdfImpor) karena daftar
  // mahasiswa satu angkatan bisa lebih besar dari lampiran biasa.
  limits: { fileSize: UPLOAD_LIMITS.pdfImpor, files: 1 }
});