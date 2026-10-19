"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const prisma_1 = __importDefault(require("../lib/prisma"));
const cookies_1 = require("../lib/cookies");
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Proteksi Brute-Force khusus untuk endpoint login
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 15 menit
    max: 5, // Batas 5 kali percobaan gagal/request per IP
    message: { message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' }
});
// Endpoint Autentikasi
router.post('/login', loginLimiter, auth_controller_1.login);
// Endpoint First Login (Wajib menyertakan token dari login awal)
// Email & no_hp wajib; foto profil opsional dikirim sebagai multipart/form-data dengan field "foto"
const unggahFotoProfil = (0, upload_middleware_1.denganWebp)(upload_middleware_1.uploadPhoto);
router.post('/first-login', auth_middleware_1.requireAuth, unggahFotoProfil.single('foto'), auth_controller_1.completeFirstLogin);
// Endpoint verifikasi email
// Dibatasi per PENGGUNA, bukan per alamat IP: di jaringan kampus banyak mahasiswa
// berbagi satu IP publik, jadi batas per-IP akan memblokir semua orang sekaligus
// begitu beberapa mahasiswa memverifikasi emailnya.
// Penjaga utama penebakan kode tetap: 5 percobaan salah + jeda 60 detik kirim ulang.
const verifikasiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user?.id || (0, express_rate_limit_1.ipKeyGenerator)(req.ip),
    message: { message: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi setelah 15 menit.' }
});
router.post('/verify-email', auth_middleware_1.requireAuth, verifikasiLimiter, auth_controller_1.verifyEmail);
router.post('/resend-verification', auth_middleware_1.requireAuth, verifikasiLimiter, auth_controller_1.resendVerification);
// Ganti password mandiri untuk SEMUA role yang sudah login.
// Dibatasi per PENGGUNA (bukan per IP) supaya mahasiswa di jaringan kampus yang
// berbagi IP tidak saling memblokir, sementara tebakan password tetap dibatasi.
const gantiPasswordLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || (0, express_rate_limit_1.ipKeyGenerator)(req.ip),
    message: { message: 'Terlalu banyak percobaan ganti password. Silakan coba lagi setelah 15 menit.' }
});
router.post('/change-password', auth_middleware_1.requireAuth, gantiPasswordLimiter, auth_controller_1.changePassword);
// --- Lupa password (tanpa login) ---------------------------------------
// Permintaan OTP dibatasi per IP karena pelakunya belum punya sesi. Endpoint
// verifikasi OTP memakai batas lebih longgar: penebakan kode sudah dibatasi
// 5 percobaan per akun di dalam controller.
const lupaPasswordLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Terlalu banyak permintaan reset password. Silakan coba lagi setelah 15 menit.' }
});
const verifikasiResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { message: 'Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit.' }
});
router.post('/lupa-password', lupaPasswordLimiter, auth_controller_1.mintaResetPassword);
router.post('/lupa-password/verifikasi', verifikasiResetLimiter, auth_controller_1.verifikasiKodeReset);
router.post('/reset-password', verifikasiResetLimiter, auth_controller_1.resetPassword);
// Endpoint Logout
router.post('/logout', (req, res) => {
    res.clearCookie(cookies_1.TOKEN_COOKIE, (0, cookies_1.opsiHapusCookieToken)(req));
    res.json({ message: 'Logout berhasil.' });
});
// Endpoint untuk mengecek status sesi aktif saat ini.
// Dibaca langsung dari database (bukan dari isi token) supaya status first_login
// dan status verifikasi email tidak pernah basi setelah pengguna mengubahnya.
//
// Tamu (belum punya sesi) mendapat 200 dengan `user: null`, bukan 401. Ini
// disengaja: halaman publik memanggil endpoint ini saat pertama dibuka, dan
// balasan 401 membuat browser mencatat error jaringan di console pengunjung.
// Endpoint yang memang butuh login tetap memakai requireAuth dan mengembalikan 401.
router.get('/me', auth_middleware_1.optionalAuth, async (req, res, next) => {
    try {
        if (!req.user) {
            res.json({ user: null });
            return;
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id }, include: { profile: true } });
        if (!user) {
            res.json({ user: null });
            return;
        }
        res.json({ user: (0, auth_controller_1.buildAuthUser)(user, user.profile) });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
