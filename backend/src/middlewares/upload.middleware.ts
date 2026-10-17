import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Buat folder 'uploads/' jika belum ada
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Satu sumber kebenaran untuk batas ukuran unggahan.
// app.ts memakainya juga agar pesan error ukuran file selalu sinkron dengan konfigurasi di sini.
export const UPLOAD_LIMITS = {
  foto: 2 * 1024 * 1024, // foto profil (login pertama)
  file: 5 * 1024 * 1024, // lampiran tiket & CMS
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
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'TICKET-' + uniqueSuffix + ext);
  }
});

// Filter tipe file (Hanya PDF, JPG, PNG)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(uploadError('Format file tidak didukung. Hanya JPG, PNG, dan PDF yang diizinkan.'));
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
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'PROFILE-' + uniqueSuffix + ext);
  }
});

// Foto profil hanya menerima gambar (tanpa PDF)
const photoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(uploadError('Format foto tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
  }
};

export const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: photoFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.foto } // Maksimal 2 MB
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
  // Nama field "file" dipakai supaya pesan batas ukuran di app.ts otomatis
  // menyebut angka 5 MB dari UPLOAD_LIMITS.
  limits: { fileSize: UPLOAD_LIMITS.file, files: 1 } // Maksimal 5 MB
});