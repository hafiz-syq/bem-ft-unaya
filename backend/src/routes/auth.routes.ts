import { Router, Request, Response, NextFunction } from 'express';
import { login, completeFirstLogin, verifyEmail, resendVerification, buildAuthUser } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadPhoto } from '../middlewares/upload.middleware';
import prisma from '../lib/prisma';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// Proteksi Brute-Force khusus untuk endpoint login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // Batas 5 kali percobaan gagal/request per IP
  message: { message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' }
});

// Endpoint Autentikasi
router.post('/login', loginLimiter, login);

// Endpoint First Login (Wajib menyertakan token dari login awal)
// Email & no_hp wajib; foto profil opsional dikirim sebagai multipart/form-data dengan field "foto"
router.post('/first-login', requireAuth, uploadPhoto.single('foto'), completeFirstLogin);

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

// Endpoint Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ message: 'Logout berhasil.' });
});

// Endpoint untuk mengecek status sesi aktif saat ini.
// Dibaca langsung dari database (bukan dari isi token) supaya status first_login
// dan status verifikasi email tidak pernah basi setelah pengguna mengubahnya.
router.get('/me', requireAuth, async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { profile: true } });
    if (!user) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }
    res.json({ user: buildAuthUser(user, user.profile) });
  } catch (error) {
    next(error);
  }
});

export default router;