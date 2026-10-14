import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';

export const getMyProfile = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id; // Didapat dari auth.middleware

    // Ambil data user beserta relasi tabel StudentProfile (jika ada)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }

    // Ekstrak angkatan dari 2 digit pertama NIM (misal: 2214... -> Angkatan 2022)
    const angkatan = "20" + user.nim.substring(0, 2);

    res.status(200).json({
      nim: user.nim,
      role: user.role,
      isActive: user.isActive,
      angkatan: angkatan,
      // email_verified ikut dikirim supaya halaman profil bisa menampilkan status
      // verifikasi tanpa perlu tahu detail kolom internal.
      profile: user.profile
        ? { ...user.profile, email_verified: Boolean(user.profile.email_verified_at) }
        : null // Admin bernilai null karena tidak ada di tabel profile
    });
  } catch (error) {
    next(error);
  }
};

// Skema validasi email pribadi
const updateEmailSchema = z.object({
  email: z.string().trim().email()
});

// Mengubah email pribadi milik pengguna yang sedang login.
// Hanya field email yang bisa diubah di sini; field profil lain tetap lewat pengajuan perubahan data.
export const updateMyEmail = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id; // Didapat dari auth.middleware

    const parsed = updateEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Format email tidak valid.' });
      return;
    }

    const email = parsed.data.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }

    if (!user.profile) {
      res.status(404).json({ message: 'Profil pengguna tidak ditemukan sehingga email tidak dapat disimpan.' });
      return;
    }

    const emailBerubah = user.profile.email !== email;

    const updated = await prisma.studentProfile.update({
      where: { userId },
      data: {
        email,
        // Email baru belum terbukti benar, jadi status verifikasi lama DIBATALKAN.
        // Tanpa ini, sekali terverifikasi akan berlaku selamanya untuk alamat apa pun.
        ...(emailBerubah ? { email_verified_at: null } : {})
      }
    });

    if (emailBerubah) {
      // Kode lama dikirim ke alamat lama, jadi dibuang sekalian.
      // last_sent_at dikosongkan agar pengguna bisa langsung minta kode ke alamat baru.
      await prisma.emailVerification.updateMany({
        where: { userId },
        data: { code_hash: null, expires_at: null, attempts: 0, last_sent_at: null }
      });
    }

    await logActivity(
      userId,
      'UPDATE_EMAIL',
      'StudentProfile',
      emailBerubah
        ? 'Pengguna mengubah email pribadinya (status verifikasi direset).'
        : 'Pengguna menyimpan ulang email pribadinya.',
      updated.id
    );

    res.status(200).json({
      message: emailBerubah
        ? 'Email berhasil diperbarui. Email baru perlu diverifikasi lagi.'
        : 'Email berhasil diperbarui.',
      emailBerubah,
      profile: { email: updated.email, email_verified: Boolean(updated.email_verified_at) }
    });
  } catch (error) {
    next(error);
  }
};