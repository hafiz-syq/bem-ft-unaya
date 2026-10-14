import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logActivity } from '../services/audit.service';
import { sendVerificationEmail } from '../services/email.service';
import crypto from 'crypto';

export const loginSchema = z.object({
  nim: z.string().min(1),
  password: z.string().min(1)
});

// --- Pengaturan verifikasi email ---
export const CODE_TTL_MINUTES = 15; // masa berlaku kode
const MAX_VERIFY_ATTEMPTS = 5; // kode hangus setelah 5 kali salah
const RESEND_COOLDOWN_SECONDS = 60; // jeda minimal antar kirim ulang

/**
 * Bentuk data user yang dikirim ke frontend.
 * email & email_verified ikut dikirim supaya frontend bisa menahan pengguna
 * di halaman verifikasi selama emailnya belum terbukti benar.
 */
export const buildAuthUser = (user: any, profile: any) => ({
  id: user.id,
  nim: user.nim,
  role: user.role,
  first_login: user.first_login,
  email: profile?.email ?? null,
  email_verified: Boolean(profile?.email_verified_at)
});

/**
 * Buat kode 6 digit, simpan hash-nya, lalu kirim ke email pengguna.
 * Mengembalikan true kalau email benar-benar berhasil dikirim.
 */
const issueVerificationCode = async (
  userId: string,
  profile: { nama: string; email: string }
): Promise<boolean> => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = await bcrypt.hash(code, 10);

  const dataKode = {
    code_hash: codeHash,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    last_sent_at: new Date()
  };

  // Disimpan di tabel EmailVerification (terpisah dari StudentProfile)
  await prisma.emailVerification.upsert({
    where: { userId },
    create: { userId, ...dataKode },
    update: dataKode
  });

  return sendVerificationEmail(profile.email, profile.nama, code, CODE_TTL_MINUTES);
};

export const login = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const { nim, password } = req.body;

    // 1. Cari user berdasarkan NIM (profil ikut diambil untuk status verifikasi email)
    const user = await prisma.user.findUnique({ where: { nim }, include: { profile: true } });
    if (!user) {
      res.status(401).json({ message: 'NIM atau Password salah.' });
      return; // WAJIB ADA agar eksekusi berhenti di sini
    }

    // 2. Validasi Password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'NIM atau Password salah.' });
      return; // WAJIB ADA agar eksekusi berhenti di sini
    }

    // 3. Buat JWT Token
    const token = jwt.sign(
      { id: user.id, nim: user.nim, role: user.role, first_login: user.first_login },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    // 4. Set Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 hari
    });

    // 5. Kirim data User HANYA SATU KALI ke Frontend
    res.status(200).json({
      message: 'Login berhasil',
      user: buildAuthUser(user, user.profile)
    });
    
  } catch (error) {
    // Serahkan error tidak terduga ke Global Error Handler di app.ts
    next(error); 
  }
};

export const completeFirstLoginSchema = z.object({
  email: z.string().trim().email({ message: 'Format email tidak valid.' }),
  no_hp: z.string().trim().min(10, { message: 'Nomor HP/WA minimal 10 digit.' }),
  password_baru: z.string().min(8, { message: 'Password baru minimal 8 karakter.' }),
  konfirmasi_password: z.string()
}).refine(data => data.password_baru === data.konfirmasi_password, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['konfirmasi_password']
});

export const completeFirstLogin = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const userId = req.user?.id; // Didapatkan dari auth.middleware

    if (!userId) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }

    // 1. Validasi seluruh isian (email & no_hp WAJIB, foto opsional)
    const parsed = completeFirstLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message || 'Data yang dikirim tidak valid.' });
      return;
    }

    const { email, no_hp, password_baru } = parsed.data;

    // 2. Pastikan ini memang login pertama
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }

    if (!user.first_login) {
      res.status(400).json({ message: 'Pengaturan ini hanya berlaku pada login pertama.' });
      return;
    }

    // 3. Hash password baru
    const password_hash = await bcrypt.hash(password_baru, 10);

    // 4. Foto profil bersifat OPSIONAL
    const foto = req.file ? `/uploads/${req.file.filename}` : undefined;

    // 5. Simpan password, status first_login, dan data profil dalam satu transaksi
    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          password_hash,
          first_login: false
        }
      });

      if (user.profile) {
        await tx.studentProfile.update({
          where: { userId },
          data: {
            email: email.toLowerCase(),
            no_hp,
            ...(foto ? { foto } : {})
          }
        });
      }

      return u;
    });

    // 6. Kirim kode verifikasi ke email yang baru saja disimpan.
    //    Kalau pengiriman gagal, datanya tetap tersimpan dan pengguna bisa kirim ulang.
    const terkirim = await issueVerificationCode(userId, {
      nama: user.profile?.nama || user.nim,
      email: email.toLowerCase()
    });

    // 7. Buat ulang Token JWT karena status first_login sudah berubah
    const newToken = jwt.sign(
      { id: updatedUser.id, nim: updatedUser.nim, role: updatedUser.role, first_login: false },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    // 8. Set Cookie baru
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 hari
    });

    res.status(200).json({
      message: terkirim
        ? `Data berhasil disimpan. Kode verifikasi telah dikirim ke ${email.toLowerCase()}.`
        : 'Data berhasil disimpan, tapi kode verifikasi gagal terkirim. Gunakan "Kirim ulang kode" di halaman berikutnya.',
      emailSent: terkirim,
      user: buildAuthUser(
        { ...updatedUser, first_login: false },
        { email: email.toLowerCase(), email_verified_at: null }
      )
    });
  } catch (error) {
    next(error);
  }
};

// --- Memasukkan kode verifikasi email ---
export const verifyEmail = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }

    const kode = typeof req.body?.kode === 'string' ? req.body.kode.trim() : '';
    if (!/^\d{6}$/.test(kode)) {
      res.status(400).json({ message: 'Kode verifikasi harus berupa 6 digit angka.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }
    const profile = user.profile;
    if (!profile || !profile.email) {
      res.status(400).json({ message: 'Belum ada email yang perlu diverifikasi.' });
      return;
    }

    // Sudah terverifikasi sebelumnya: anggap berhasil supaya tidak mentok
    if (profile.email_verified_at) {
      res.status(200).json({ message: 'Email Anda sudah terverifikasi.', user: buildAuthUser(user, profile) });
      return;
    }

    const dataVerifikasi = await prisma.emailVerification.findUnique({ where: { userId } });

    if (!dataVerifikasi?.code_hash || !dataVerifikasi.expires_at) {
      res.status(400).json({ message: 'Belum ada kode verifikasi yang aktif. Silakan kirim ulang kode.' });
      return;
    }

    if (dataVerifikasi.expires_at.getTime() < Date.now()) {
      res.status(400).json({ message: 'Kode verifikasi sudah kedaluwarsa. Silakan kirim ulang kode baru.' });
      return;
    }

    if (dataVerifikasi.attempts >= MAX_VERIFY_ATTEMPTS) {
      res.status(429).json({ message: 'Terlalu banyak percobaan salah. Silakan kirim ulang kode baru.' });
      return;
    }

    const cocok = await bcrypt.compare(kode, dataVerifikasi.code_hash);

    if (!cocok) {
      const attempts = dataVerifikasi.attempts + 1;
      const habis = attempts >= MAX_VERIFY_ATTEMPTS;

      await prisma.emailVerification.update({
        where: { userId },
        data: {
          attempts,
          // Kode dihanguskan supaya tidak bisa ditebak terus-menerus
          ...(habis ? { code_hash: null, expires_at: null } : {})
        }
      });

      res.status(400).json({
        message: habis
          ? 'Kode salah. Batas percobaan habis, silakan kirim ulang kode baru.'
          : `Kode verifikasi salah. Sisa percobaan: ${MAX_VERIFY_ATTEMPTS - attempts}.`
      });
      return;
    }

    // Kode benar: bersihkan sisa kode dan tandai email terverifikasi
    const verifiedProfile = await prisma.studentProfile.update({
      where: { userId },
      data: { email_verified_at: new Date() }
    });

    // Kode tidak diperlukan lagi setelah email terverifikasi
    await prisma.emailVerification.updateMany({
      where: { userId },
      data: { code_hash: null, expires_at: null, attempts: 0 }
    });

    await logActivity(
      userId,
      'VERIFY_EMAIL',
      'StudentProfile',
      `Pengguna memverifikasi email ${verifiedProfile.email}`,
      verifiedProfile.id
    );

    res.status(200).json({
      message: 'Email berhasil diverifikasi.',
      user: buildAuthUser(user, verifiedProfile)
    });
  } catch (error) {
    next(error);
  }
};

// --- Kirim ulang kode verifikasi (sekaligus bisa mengganti email yang salah ketik) ---
export const resendVerification = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }
    if (!user.profile) {
      res.status(400).json({ message: 'Profil Anda belum tersedia, hubungi admin.' });
      return;
    }

    let profile = user.profile;

    if (profile.email_verified_at) {
      res.status(200).json({ message: 'Email Anda sudah terverifikasi.', user: buildAuthUser(user, profile) });
      return;
    }

    // Pengguna boleh memperbaiki emailnya di sini supaya tidak terjebak
    // kalau salah ketik dan tidak pernah menerima kode.
    const emailBaru = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (emailBaru && emailBaru !== profile.email) {
      const parsed = z.string().email({ message: 'Format email tidak valid.' }).safeParse(emailBaru);
      if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || 'Format email tidak valid.' });
        return;
      }

      profile = await prisma.studentProfile.update({
        where: { userId },
        data: { email: emailBaru, email_verified_at: null }
      });

      await logActivity(
        userId,
        'UPDATE_EMAIL',
        'StudentProfile',
        `Pengguna mengubah email menjadi ${emailBaru} saat verifikasi`,
        profile.id
      );
    }

    if (!profile.email) {
      res.status(400).json({ message: 'Belum ada email yang bisa dikirimi kode. Isi email Anda dulu.' });
      return;
    }

    // Batas frekuensi kirim ulang supaya tidak dijadikan alat spam
    const dataVerifikasi = await prisma.emailVerification.findUnique({ where: { userId } });
    if (dataVerifikasi?.last_sent_at) {
      const lewatDetik = Math.floor((Date.now() - dataVerifikasi.last_sent_at.getTime()) / 1000);
      const sisaDetik = RESEND_COOLDOWN_SECONDS - lewatDetik;
      if (sisaDetik > 0) {
        res.status(429).json({ message: `Mohon tunggu ${sisaDetik} detik sebelum meminta kode baru.` });
        return;
      }
    }

    const terkirim = await issueVerificationCode(userId, {
      nama: profile.nama || user.nim,
      email: profile.email
    });

    if (!terkirim) {
      res.status(502).json({
        message: `Kode gagal dikirim ke ${profile.email}. Pastikan alamat emailnya benar, lalu coba lagi sebentar lagi.`
      });
      return;
    }

    res.status(200).json({
      message: `Kode verifikasi baru telah dikirim ke ${profile.email}.`,
      email: profile.email,
      user: buildAuthUser(user, profile)
    });
  } catch (error) {
    next(error);
  }
};