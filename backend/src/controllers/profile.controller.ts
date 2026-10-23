import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { hapusFotoProfil, simpanFotoProfil } from '../lib/foto-profil';
import { logActivity } from '../services/audit.service';
import { hitungAngkatan } from '../services/account-lifecycle.service';

export const getMyProfile = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id; // Didapat dari auth.middleware

    // Ambil data user beserta relasi tabel StudentProfile (jika ada)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        // Jabatan aktif ditampilkan sebagai bagian biodata di halaman profil.
        positions: {
          where: { isActive: true },
          include: {
            positionSlot: { include: { organization: true, department: true } }
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }

    res.status(200).json({
      id: user.id,
      nim: user.nim,
      role: user.role,
      isActive: user.isActive,
      // Email akun untuk semua role: kolom User.email (admin/superadmin) atau
      // email profil (mahasiswa/pengurus). Dipakai form lupa password.
      email: user.email ?? user.profile?.email ?? null,
      // Angkatan dibaca dari 2 digit pertama NIM (misal: 2214... -> Angkatan 2022)
      angkatan: hitungAngkatan(user.nim),
      // Foto profil diprioritaskan dari tabel User supaya berlaku untuk SEMUA role,
      // termasuk admin yang tidak punya baris StudentProfile.
      foto: user.foto ?? user.profile?.foto ?? null,
      deactivatedAt: user.deactivatedAt,
      deactivationType: user.deactivationType,
      createdAt: user.createdAt,
      // email_verified ikut dikirim supaya halaman profil bisa menampilkan status
      // verifikasi tanpa perlu tahu detail kolom internal.
      profile: user.profile
        ? { ...user.profile, email_verified: Boolean(user.profile.email_verified_at) }
        : null, // Admin bernilai null karena tidak ada di tabel profile
      email_verified: Boolean(user.profile?.email_verified_at),
      jabatan: user.positions.map((p) => ({
        id: p.id,
        title: p.positionSlot.title,
        organisasi: p.positionSlot.organization.name,
        divisi: p.positionSlot.department?.name ?? null,
        startDate: p.startDate,
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Profil publik satu akun, dibuka dari avatar/nama pengguna di halaman mana pun.
 *
 * Hanya pengguna yang sudah login yang boleh memanggil endpoint ini (tamu
 * ditolak 401 oleh requireAuth). Data yang dikirim sengaja terbatas pada
 * biodata yang memang tampil di komunitas: nama, NIM, program studi, angkatan,
 * foto, role, status akun, dan jabatan aktif. Email serta nomor HP tidak ikut
 * supaya data kontak pribadi tidak bisa diambil orang lain hanya dengan
 * menebak ID akun.
 */
export const getPublicProfile = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ message: 'ID pengguna wajib diisi.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nim: true,
        role: true,
        isActive: true,
        foto: true,
        createdAt: true,
        profile: { select: { nama: true, program_studi: true, foto: true } },
        positions: {
          where: { isActive: true },
          select: {
            positionSlot: {
              select: {
                title: true,
                organization: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
      return;
    }

    res.status(200).json({
      data: {
        id: user.id,
        nim: user.nim,
        role: user.role,
        isActive: user.isActive,
        foto: user.foto ?? user.profile?.foto ?? null,
        angkatan: hitungAngkatan(user.nim),
        bergabung: user.createdAt,
        nama: user.profile?.nama ?? null,
        programStudi: user.profile?.program_studi ?? null,
        jabatan: user.positions.map((p) => ({
          title: p.positionSlot.title,
          organisasi: p.positionSlot.organization.name,
          divisi: p.positionSlot.department?.name ?? null,
        })),
      },
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

    // Email yang sama tidak boleh dipakai dua akun, karena lupa password
    // mencocokkan email ke akun. Diperiksa lebih dulu agar balasannya jelas.
    const dipakaiAkunLain = await prisma.user.findFirst({
      where: { email, id: { not: userId } },
      select: { id: true }
    });
    if (dipakaiAkunLain) {
      res.status(409).json({ message: 'Email ini sudah dipakai akun lain.' });
      return;
    }

    // Akun tanpa StudentProfile (ADMIN/SUPERADMIN) menyimpan emailnya di tabel
    // User, supaya fitur lupa password juga berlaku untuk mereka.
    if (!user.profile) {
      const emailBerubah = (user.email ?? null) !== email;
      await prisma.user.update({ where: { id: userId }, data: { email } });

      await logActivity(
        userId,
        'UPDATE_EMAIL',
        'User',
        emailBerubah ? 'Pengguna mengubah email akunnya.' : 'Pengguna menyimpan ulang email akunnya.',
        userId
      );

      res.status(200).json({
        message: 'Email akun berhasil diperbarui.',
        emailBerubah,
        email,
        profile: null
      });
      return;
    }

    const emailBerubah = user.profile.email !== email;

    const updated = await prisma.$transaction(async (tx) => {
      // Email akun di tabel User ikut disamakan supaya lupa password membaca
      // alamat yang sama dengan yang tampil di profil.
      await tx.user.update({ where: { id: userId }, data: { email } });

      return tx.studentProfile.update({
        where: { userId },
        data: {
          email,
          // Email baru belum terbukti benar, jadi status verifikasi lama DIBATALKAN.
          // Tanpa ini, sekali terverifikasi akan berlaku selamanya untuk alamat apa pun.
          ...(emailBerubah ? { email_verified_at: null } : {})
        }
      });
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

/**
 * Mengunggah / mengganti foto profil milik pengguna yang sedang login.
 * Berlaku untuk SEMUA role dan disimpan di kolom User.foto agar admin
 * (yang tidak punya StudentProfile) juga bisa punya foto.
 */
export const uploadMyPhoto = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'Pilih file foto terlebih dahulu.' });
      return;
    }

    // Foto disimpan di Cloudinary; yang masuk database adalah URL lengkapnya
    // (https://res.cloudinary.com/...). URL ini tetap hidup walaupun aplikasi
    // di-deploy ulang, tidak seperti berkas di /tmp pada Vercel.
    const foto = await simpanFotoProfil(file);

    // Foto sebelumnya dibaca sebelum ditimpa supaya berkas lamanya bisa dibuang.
    const sebelumnya = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { foto: true, profile: { select: { foto: true } } }
    });

    await prisma.user.update({ where: { id: req.user.id }, data: { foto } });

    // Profil (untuk mahasiswa/pengurus) disamakan agar tampilan lama tetap konsisten.
    await prisma.studentProfile.updateMany({ where: { userId: req.user.id }, data: { foto } });

    // Baru setelah database tersimpan: buang berkas lama agar tidak menumpuk.
    const fotoLama = new Set([sebelumnya?.foto, sebelumnya?.profile?.foto]);
    for (const lama of fotoLama) {
      if (lama && lama !== foto) hapusFotoProfil(lama);
    }

    await logActivity(
      req.user.id,
      'UPDATE_PHOTO',
      'User',
      'Memperbarui foto profil',
      req.user.id
    );

    res.status(200).json({ message: 'Foto profil berhasil diperbarui.', foto });
  } catch (error) {
    next(error);
  }
};

/**
 * Menghapus foto profil milik pengguna yang sedang login.
 * Berlaku untuk SEMUA role, termasuk ADMIN/SUPERADMIN yang tidak punya baris
 * StudentProfile. Kedua kolom dikosongkan agar foto lama tidak muncul lagi
 * dari sumber cadangan (profil), lalu berkasnya dibuang dari folder uploads.
 */
export const deleteMyPhoto = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { foto: true, profile: { select: { foto: true } } }
    });

    if (!user) {
      res.status(404).json({ message: 'Data pengguna tidak ditemukan.' });
      return;
    }

    // Foto bisa tersimpan di User (semua role) atau hanya di StudentProfile
    // (data lama). Keduanya dibaca supaya berkas yang benar ikut terhapus.
    const fotoLama = user.foto ?? user.profile?.foto ?? null;

    if (!fotoLama) {
      res.status(200).json({ message: 'Akun ini memang belum memiliki foto profil.', foto: null });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { foto: null } }),
      prisma.studentProfile.updateMany({ where: { userId }, data: { foto: null } })
    ]);

    // Foto lama bisa berupa URL Cloudinary (foto baru) atau /uploads/... (data lama).
    hapusFotoProfil(fotoLama);

    await logActivity(
      userId,
      'DELETE_PHOTO',
      'User',
      'Menghapus foto profil',
      userId
    );

    res.status(200).json({ message: 'Foto profil berhasil dihapus.', foto: null });
  } catch (error) {
    next(error);
  }
};