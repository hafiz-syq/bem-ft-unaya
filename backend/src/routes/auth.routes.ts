import { Router, Request, Response, NextFunction } from 'express';
import {
  login,
  completeFirstLogin,
  verifyEmail,
  resendVerification,
  buildAuthUser,
  changePassword,
  mintaResetPassword,
  verifikasiKodeReset,
  resetPassword,
} from '../controllers/auth.controller';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware';
import { uploadFotoMemori } from '../middlewares/upload.middleware';
import prisma from '../lib/prisma';
import { opsiHapusCookieToken, TOKEN_COOKIE } from '../lib/cookies';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// Proteksi Brute-Force khusus untuk endpoint login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 menit
  max: 5, // Batas 5 kali percobaan gagal/request per IP
  message: { message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' }
});

// Endpoint Autentikasi
router.post('/login', loginLimiter, login);

// Endpoint First Login (Wajib menyertakan token dari login awal)
// Email & no_hp wajib; foto profil opsional dikirim sebagai multipart/form-data dengan field "foto"
// Foto dibaca dari memori lalu disimpan ke Cloudinary oleh controller.
router.post('/first-login', requireAuth, uploadFotoMemori.single('foto'), completeFirstLogin);

// Endpoint verifikasi email
// Dibatasi per PENGGUNA, bukan per alamat IP: di jaringan kampus banyak mahasiswa
// berbagi satu IP publik, jadi batas per-IP akan memblokir semua orang sekaligus
// begitu beberapa mahasiswa memverifikasi emailnya.
// Penjaga utama penebakan kode tetap: 5 percobaan salah + jeda 60 detik kirim ulang.
const verifikasiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip),
  message: { message: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi setelah 15 menit.' }
});

router.post('/verify-email', requireAuth, verifikasiLimiter, verifyEmail);
router.post('/resend-verification', requireAuth, verifikasiLimiter, resendVerification);

// Ganti password mandiri untuk SEMUA role yang sudah login.
// Dibatasi per PENGGUNA (bukan per IP) supaya mahasiswa di jaringan kampus yang
// berbagi IP tidak saling memblokir, sementara tebakan password tetap dibatasi.
const gantiPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip),
  message: { message: 'Terlalu banyak percobaan ganti password. Silakan coba lagi setelah 15 menit.' }
});

router.post('/change-password', requireAuth, gantiPasswordLimiter, changePassword);

// --- Lupa password (tanpa login) ---------------------------------------
// Permintaan OTP dibatasi per IP karena pelakunya belum punya sesi. Endpoint
// verifikasi OTP memakai batas lebih longgar: penebakan kode sudah dibatasi
// 5 percobaan per akun di dalam controller.
const lupaPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Terlalu banyak permintaan reset password. Silakan coba lagi setelah 15 menit.' }
});

const verifikasiResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit.' }
});

router.post('/lupa-password', lupaPasswordLimiter, mintaResetPassword);
router.post('/lupa-password/verifikasi', verifikasiResetLimiter, verifikasiKodeReset);
router.post('/reset-password', verifikasiResetLimiter, resetPassword);

// Endpoint Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(TOKEN_COOKIE, opsiHapusCookieToken(req));
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
router.get('/me', optionalAuth, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.json({ user: null });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { profile: true } });
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: buildAuthUser(user, user.profile) });
  } catch (error) {
    next(error);
  }
});

export default router;