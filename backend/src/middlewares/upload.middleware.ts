import multer from 'multer';
import path from 'path';
import sharp from 'sharp';

// Satu sumber kebenaran untuk batas ukuran unggahan.
// app.ts memakainya juga agar pesan error ukuran file selalu sinkron dengan konfigurasi di sini.
export const UPLOAD_LIMITS = {
  foto: 2 * 1024 * 1024, // foto profil (login pertama)
  file: 5 * 1024 * 1024, // lampiran tiket & CMS
  pdfImpor: 10 * 1024 * 1024, // KHUSUS untuk impor data mahasiswa
  dokumen: 10 * 1024 * 1024, // arsip surat & proposal
} as const;

// Error validasi unggahan adalah kesalahan INPUT PENGGUNA, bukan kegagalan server.
// Properti statusCode ini dibaca oleh Global Error Handler di app.ts agar balasannya 400, bukan 500.
const uploadError = (message: string): Error => {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
};

// Semua unggahan sekarang ditahan di memori.
//
// Dulu lampiran/cover/dokumen ditulis ke disk lewat multer.diskStorage, tetapi
// di Vercel filesystem serverless bersifat sementara: berkas di /tmp hilang
// saat instance dingin atau deploy ulang, sehingga URL /uploads/... yang
// tersimpan di database mengarah ke berkas yang sudah tidak ada. Berkas yang
// benar-benar perlu disimpan permanen justru ditulis setelah middleware ini —
// ke Cloudinary lewat lib/gambar-media.ts (galeri, cover, foto demisioner)
// dan lib/lampiran.ts (lampiran tiket, arsip dokumen).
//
// Catatan batas: satu unggahan paling besar 10 MB (pdfImpor/dokumen);
// menahan dua-tiga berkas sebesar itu di memori masih aman untuk function.

// Filter tipe file untuk lampiran tiket & CMS: semua GAMBAR (kecuali SVG) + PDF.
// Gambar non-WebP akan dikonversi setelah middleware ini. SVG sengaja ditolak:
// berkas itu bisa memuat skrip, bukan sekadar gambar.
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const gambar = file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml';
  if (gambar || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(uploadError('Format file tidak didukung. Gunakan gambar (JPG, PNG, WEBP, HEIC, GIF, dst.) atau PDF.'));
  }
};

export const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: UPLOAD_LIMITS.file }, // Maksimal 5 MB
});

// --- Foto profil & foto demisioner (dipakai saat login pertama / jabatan) ---
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
  storage: multer.memoryStorage(),
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.foto }, // Maksimal 2 MB
});

// Foto profil pengguna disimpan di Cloudinary, jadi isinya cukup ditahan di
// memori sampai selesai diunggah. Tidak ada berkas yang ditulis ke disk: di
// Vercel filesystem bersifat read-only dan `/tmp` hilang setiap instance baru,
// yang membuat foto profil sebelumnya tampak menghilang.
export const uploadFotoMemori = multer({
  storage: multer.memoryStorage(),
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.foto }, // Maksimal 2 MB
});

// Gambar media (galeri & cover konten) ditahan di memori lalu diunggah ke
// Cloudinary oleh controller. Tidak ada berkas yang ditulis ke disk karena di
// Vercel folder sementara hilang dan foto menjadi rusak di halaman publik.
export const uploadGambarMemori = multer({
  storage: multer.memoryStorage(),
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.file, files: 10 },
});

// ================= KONVERSI GAMBAR KE WEBP (dalam memori) =================
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

const konversiSatuGambar = async (file: Express.Multer.File): Promise<void> => {
  if (!file.buffer?.length) return;

  try {
    const webp = await sharp(file.buffer, {
      failOn: 'none',
      // Batasi piksel agar berkas kecil yang "meledak" saat didekode tidak
      // menghabiskan memori server. 60 MP masih cukup untuk foto kamera HP.
      limitInputPixels: 60_000_000,
    })
      .rotate() // menghormati orientasi EXIF dari kamera HP
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    file.buffer = webp;
    file.mimetype = 'image/webp';
    file.size = webp.length;
    file.originalname = `${path.parse(file.originalname || 'gambar').name}.webp`;
  } catch {
    throw uploadError(
      `Gambar "${file.originalname}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`
    );
  }
};

export const konversiGambarKeWebp = async (req: any, res: any, next: any): Promise<void> => {
  const files = kumpulanFile(req);

  for (const file of files) {
    if (!file.mimetype?.startsWith('image/')) continue;

    // Lewati hanya bila isi DAN ekstensinya benar-benar WebP. Berkas WebP yang
    // diunggah dengan nama .jpg tetap dinormalkan agar Content-Type saat
    // disajikan tidak menyesatkan browser.
    const sudahWebp =
      file.mimetype === 'image/webp' && path.extname(file.originalname || '').toLowerCase() === '.webp';
    if (sudahWebp) continue;

    try {
      await konversiSatuGambar(file);
    } catch (error) {
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
  // Beberapa browser (terutama dari HP/penyimpanan awan) mengirim PDF dengan
  // MIME `application/octet-stream` atau kosong. Yang penting adalah ekstensi
  // .pdf; isi berkasnya tetap diverifikasi lewat tanda tangan %PDF- di
  // controller sebelum diproses.
  const mimePdf = ['application/pdf', 'application/x-pdf'].includes(file.mimetype);
  const ekstensiPdf = path.extname(file.originalname || '').toLowerCase() === '.pdf';

  if (mimePdf || ekstensiPdf) {
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
  limits: { fileSize: UPLOAD_LIMITS.pdfImpor, files: 1 },
});

// --- Arsip surat & proposal ------------------------------------------------
// PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX ditahan di memori lalu disimpan ke Cloudinary
// oleh controller (lib/lampiran.ts). SVG dan berkas executable ditolak.
//
// Peta ini satu-satunya sumber daftar MIME dokumen yang diizinkan. Ekstensi
// berkas yang disajikan diturunkan dari MIME di sini, BUKAN dari nama berkas
// kiriman pengguna: `surat.html` berisi `%PDF-` dengan MIME application/pdf
// dulu lolos filter dan tersimpan berekstensi .html, sehingga browser
// menjalankan isinya sebagai halaman web (stored XSS).
export const EKSTENSI_DOKUMEN: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

/**
 * Ekstensi kanonis untuk MIME yang sudah divalidasi filter.
 *
 * MIME asing/berparameter (`application/pdf; charset=binary`) tidak pernah
 * jatuh ke ekstensi bebas: yang tidak dikenal dipaksa `.pdf`, ekstensi paling
 * aman karena isinya sudah dipastikan diawali `%PDF-` oleh pastikanIsiDokumenSah.
 */
export const ekstensiDokumen = (mimetype: string | undefined): string =>
  EKSTENSI_DOKUMEN[String(mimetype || '').split(';')[0].trim().toLowerCase()] ?? '.pdf';

const dokumenFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (EKSTENSI_DOKUMEN[file.mimetype]) cb(null, true);
  else cb(uploadError('Format dokumen tidak didukung. Gunakan PDF, DOC/DOCX, XLS/XLSX, atau PPT/PPTX.'));
};

export const uploadDokumen = multer({
  storage: multer.memoryStorage(),
  fileFilter: dokumenFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.dokumen, files: 1 },
});
