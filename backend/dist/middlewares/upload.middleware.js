"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPdfImpor = exports.uploadPhoto = exports.uploadAttachment = exports.UPLOAD_LIMITS = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Buat folder 'uploads/' jika belum ada
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Satu sumber kebenaran untuk batas ukuran unggahan.
// app.ts memakainya juga agar pesan error ukuran file selalu sinkron dengan konfigurasi di sini.
exports.UPLOAD_LIMITS = {
    foto: 2 * 1024 * 1024, // foto profil (login pertama)
    file: 5 * 1024 * 1024, // lampiran tiket & CMS
};
// Error validasi unggahan adalah kesalahan INPUT PENGGUNA, bukan kegagalan server.
// Properti statusCode ini dibaca oleh Global Error Handler di app.ts agar balasannya 400, bukan 500.
const uploadError = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
};
// Konfigurasi penyimpanan
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, 'TICKET-' + uniqueSuffix + ext);
    }
});
// Filter tipe file (Hanya PDF, JPG, PNG)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(uploadError('Format file tidak didukung. Hanya JPG, PNG, dan PDF yang diizinkan.'));
    }
};
exports.uploadAttachment = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: exports.UPLOAD_LIMITS.file } // Maksimal 5 MB
});
// --- Khusus foto profil (dipakai saat login pertama) ---
const photoStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, 'PROFILE-' + uniqueSuffix + ext);
    }
});
// Foto profil hanya menerima gambar (tanpa PDF)
const photoFileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(uploadError('Format foto tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
    }
};
exports.uploadPhoto = (0, multer_1.default)({
    storage: photoStorage,
    fileFilter: photoFileFilter,
    limits: { fileSize: exports.UPLOAD_LIMITS.foto } // Maksimal 2 MB
});
// --- Khusus berkas PDF impor data mahasiswa ---
// Isinya hanya dibaca sekali untuk diproses, jadi disimpan di memori dan tidak
// pernah menyentuh disk: dengan begitu tidak ada berkas sementara yang perlu
// dibersihkan setelah proses selesai (berhasil maupun gagal).
const pdfFileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    }
    else {
        cb(uploadError('Berkas impor harus berupa PDF.'));
    }
};
exports.uploadPdfImpor = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: pdfFileFilter,
    // Nama field "file" dipakai supaya pesan batas ukuran di app.ts otomatis
    // menyebut angka 5 MB dari UPLOAD_LIMITS.
    limits: { fileSize: exports.UPLOAD_LIMITS.file, files: 1 } // Maksimal 5 MB
});
