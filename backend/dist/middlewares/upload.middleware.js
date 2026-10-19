"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPdfImpor = exports.denganWebp = exports.konversiGambarKeWebp = exports.uploadPhoto = exports.uploadAttachment = exports.UPLOAD_LIMITS = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
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
// Filter tipe file: semua GAMBAR (kecuali SVG) + PDF.
// Gambar non-WebP akan dikonversi setelah multer selesai menyimpannya.
// SVG sengaja ditolak: berkas itu bisa memuat skrip, bukan sekadar gambar.
const fileFilter = (req, file, cb) => {
    const gambar = file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml';
    if (gambar || file.mimetype === 'application/pdf') {
        cb(null, true);
    }
    else {
        cb(uploadError('Format file tidak didukung. Gunakan gambar (JPG, PNG, WEBP, HEIC, GIF, dst.) atau PDF.'));
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
// Foto profil hanya menerima gambar (tanpa PDF). Semua format gambar yang
// dikenali sharp (JPG, PNG, WEBP, HEIC, GIF, AVIF, TIFF) diterima.
const photoFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
        cb(null, true);
    }
    else {
        cb(uploadError('Format foto tidak didukung. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).'));
    }
};
exports.uploadPhoto = (0, multer_1.default)({
    storage: photoStorage,
    fileFilter: photoFileFilter,
    limits: { fileSize: exports.UPLOAD_LIMITS.foto } // Maksimal 2 MB
});
// ================= KONVERSI GAMBAR KE WEBP =================
// Semua unggahan gambar selain WebP diproses ulang menjadi WebP supaya ukuran
// transfer lebih kecil. Foto yang sudah WebP dibiarkan apa adanya (tidak
// dikompresi ulang) agar kualitasnya tidak turun berulang kali.
//
// PDF tidak disentuh: hanya lampiran tiket yang boleh PDF.
const kumpulanFile = (req) => {
    const hasil = [];
    if (req.file)
        hasil.push(req.file);
    const files = req.files;
    if (Array.isArray(files)) {
        hasil.push(...files);
    }
    else if (files && typeof files === 'object') {
        for (const daftar of Object.values(files)) {
            if (Array.isArray(daftar))
                hasil.push(...daftar);
        }
    }
    return hasil;
};
const hapusFile = async (file) => {
    if (!file?.path)
        return;
    await fs_1.default.promises.unlink(file.path).catch(() => undefined);
};
const konversiSatuGambar = async (file) => {
    const folder = file.destination || path_1.default.dirname(file.path);
    const dasar = path_1.default.parse(file.filename).name;
    const tujuan = path_1.default.join(folder, `${dasar}.webp`);
    // Bila nama berkas sudah berakhiran .webp tetapi isinya bukan WebP, jangan
    // menulis ke berkas yang sedang dibaca sharp. Pakai berkas sementara dulu.
    const sementara = path_1.default.resolve(tujuan) === path_1.default.resolve(file.path)
        ? path_1.default.join(folder, `${dasar}.konversi.webp`)
        : tujuan;
    try {
        await (0, sharp_1.default)(file.path, {
            failOn: 'none',
            // Batasi piksel agar berkas kecil yang "meledak" saat didekode tidak
            // menghabiskan memori server. 60 MP masih cukup untuk foto kamera HP.
            limitInputPixels: 60_000_000,
        })
            .rotate() // menghormati orientasi EXIF dari kamera HP
            .webp({ quality: 82, effort: 4 })
            .toFile(sementara);
        if (sementara !== tujuan) {
            await fs_1.default.promises.rename(sementara, tujuan);
        }
        if (path_1.default.resolve(tujuan) !== path_1.default.resolve(file.path)) {
            await fs_1.default.promises.unlink(file.path).catch(() => undefined);
        }
        const stat = await fs_1.default.promises.stat(tujuan);
        file.path = tujuan;
        file.filename = path_1.default.basename(tujuan);
        file.destination = folder;
        file.mimetype = 'image/webp';
        file.size = stat.size;
        file.originalname = `${path_1.default.parse(file.originalname).name}.webp`;
    }
    catch {
        // Bersihkan berkas sementara/target yang mungkin sudah setengah tertulis.
        await fs_1.default.promises.unlink(sementara).catch(() => undefined);
        if (sementara !== tujuan)
            await fs_1.default.promises.unlink(tujuan).catch(() => undefined);
        throw uploadError(`Gambar "${file.originalname}" tidak dapat diproses. Gunakan JPG, PNG, WEBP, HEIC, atau format gambar lain (bukan SVG).`);
    }
};
const konversiGambarKeWebp = async (req, res, next) => {
    const files = kumpulanFile(req);
    for (const file of files) {
        if (!file.path)
            continue;
        if (!file.mimetype?.startsWith('image/'))
            continue;
        // Lewati hanya bila isi DAN ekstensinya benar-benar WebP. Berkas WebP yang
        // diunggah dengan nama .jpg tetap dinormalkan agar Content-Type saat
        // disajikan tidak menyesatkan browser.
        const sudahWebp = file.mimetype === 'image/webp' && path_1.default.extname(file.filename).toLowerCase() === '.webp';
        if (sudahWebp)
            continue;
        try {
            await konversiSatuGambar(file);
        }
        catch (error) {
            // Jangan tinggalkan sebagian berkas di folder unggahan bila satu gambar
            // gagal diproses: pengguna harus mengulang seluruh unggahan.
            await Promise.all(files.map(hapusFile));
            next(error);
            return;
        }
    }
    next();
};
exports.konversiGambarKeWebp = konversiGambarKeWebp;
/** Membungkus multer agar setiap gambar yang tersimpan langsung menjadi WebP. */
const denganWebp = (unggah) => ({
    single: (field) => [unggah.single(field), exports.konversiGambarKeWebp],
    fields: (fields) => [unggah.fields(fields), exports.konversiGambarKeWebp],
});
exports.denganWebp = denganWebp;
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
