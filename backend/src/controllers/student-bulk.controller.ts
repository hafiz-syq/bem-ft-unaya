import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole, ASSIGNABLE_ROLES } from '../lib/ticket-access';
import { purgeStudentAccount } from '../services/account-lifecycle.service';
import {
  restoreStudentAccount,
  softDeleteStudentAccount,
  HARI_TEMPAT_SAMPAH,
} from '../services/student-trash.service';
import { batasHalaman } from '../lib/paginasi';

type AksiMassal = 'AKTIFKAN' | 'NONAKTIFKAN' | 'PUTUS_PERANGKAT' | 'UBAH_ROLE' | 'HAPUS';

const AKSI_VALID: AksiMassal[] = [
  'AKTIFKAN',
  'NONAKTIFKAN',
  'PUTUS_PERANGKAT',
  'UBAH_ROLE',
  'HAPUS',
];

const bacaIds = (nilai: unknown): string[] => {
  if (!Array.isArray(nilai)) return [];
  return [...new Set(nilai.map((v) => String(v || '').trim()).filter(Boolean))].slice(0, 100);
};

/**
 * Aksi massal untuk baris yang dicentang di halaman Data Mahasiswa.
 * Setiap aturan per-akun tetap berlaku: akun pengelola tidak bisa dinonaktifkan,
 * akun sendiri tidak bisa disentuh, dan hanya superadmin yang boleh menghapus
 * atau mengubah role akun pengelola.
 */
export const bulkStudents = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ids = bacaIds(req.body?.ids);
    const aksi = String(req.body?.action || '').toUpperCase() as AksiMassal;

    if (ids.length === 0) {
      res.status(400).json({ message: 'Pilih minimal satu akun terlebih dahulu.' });
      return;
    }
    if (!AKSI_VALID.includes(aksi)) {
      res.status(400).json({ message: 'Aksi massal tidak dikenali.' });
      return;
    }
    if (aksi === 'HAPUS' && req.user.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Hanya superadmin yang dapat menghapus akun.' });
      return;
    }
    if (aksi === 'UBAH_ROLE' && req.user.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Perubahan role massal hanya dapat dilakukan superadmin.' });
      return;
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        nim: true,
        role: true,
        isActive: true,
        profile: { select: { nama: true } },
      },
    });

    if (targets.length === 0) {
      res.status(404).json({ message: 'Tidak ada akun aktif yang cocok dengan pilihan.' });
      return;
    }

    let berhasil = 0;
    let dilewati = 0;
    const alasanLewat: string[] = [];

    const lewati = (nim: string, alasan: string) => {
      dilewati += 1;
      alasanLewat.push(`${nim}: ${alasan}`);
    };

    if (aksi === 'AKTIFKAN' || aksi === 'NONAKTIFKAN') {
      const boleh = targets.filter((t) => {
        if (isAdminRole(t.role)) {
          lewati(t.nim, 'akun pengelola tidak dapat diubah statusnya');
          return false;
        }
        return true;
      });

      if (boleh.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: boleh.map((t) => t.id) } },
          data:
            aksi === 'AKTIFKAN'
              ? {
                  isActive: true,
                  deactivatedAt: null,
                  deactivationType: null,
                  tenggatHapus: null,
                }
              : {
                  isActive: false,
                  deactivatedAt: new Date(),
                  deactivationType: 'MANUAL',
                  tenggatHapus: null,
                },
        });
        berhasil = boleh.length;
      }
    }

    if (aksi === 'PUTUS_PERANGKAT') {
      const boleh = targets.filter((t) => {
        if (t.id === req.user.id) {
          lewati(t.nim, 'akun sendiri tidak dapat diputus');
          return false;
        }
        if (t.role === 'SUPERADMIN') {
          lewati(t.nim, 'akun superadmin tidak dapat diputus dari sini');
          return false;
        }
        return true;
      });

      for (const t of boleh) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: t.id },
            data: {
              deviceId: null,
              deviceLabel: null,
              deviceBoundAt: null,
              pendingDeviceId: null,
              pendingDeviceLabel: null,
              pendingDeviceAt: null,
              sessionVersion: { increment: 1 },
            },
          }),
          prisma.userDevice.deleteMany({ where: { userId: t.id } }),
        ]);
      }
      berhasil = boleh.length;
    }

    if (aksi === 'UBAH_ROLE') {
      const roleBaru = String(req.body?.role || '').toUpperCase();
      if (!ASSIGNABLE_ROLES.includes(roleBaru)) {
        res.status(400).json({ message: 'Role tujuan tidak dikenali.' });
        return;
      }

      const boleh = targets.filter((t) => {
        if (t.id === req.user.id) {
          lewati(t.nim, 'role akun sendiri tidak dapat diubah');
          return false;
        }
        if (t.role === 'SUPERADMIN') {
          lewati(t.nim, 'akun superadmin tidak dapat diubah dari halaman ini');
          return false;
        }
        return true;
      });

      if (boleh.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: boleh.map((t) => t.id) } },
          data: { role: roleBaru as any },
        });
        berhasil = boleh.length;
      }
    }

    if (aksi === 'HAPUS') {
      const boleh = targets.filter((t) => {
        if (t.id === req.user.id) {
          lewati(t.nim, 'akun sendiri tidak dapat dihapus');
          return false;
        }
        if (isAdminRole(t.role)) {
          lewati(t.nim, 'akun pengelola tidak dapat dihapus');
          return false;
        }
        return true;
      });

      for (const t of boleh) {
        await softDeleteStudentAccount(t.id, req.user.id, 'Dihapus massal dari Data Mahasiswa');
      }
      berhasil = boleh.length;
    }

    const label: Record<AksiMassal, string> = {
      AKTIFKAN: 'mengaktifkan',
      NONAKTIFKAN: 'menonaktifkan',
      PUTUS_PERANGKAT: 'memutus perangkat',
      UBAH_ROLE: 'mengubah role',
      HAPUS: 'memindahkan ke tempat sampah',
    };

    await logActivity(
      req.user.id,
      `BULK_${aksi}`,
      'User',
      `Aksi massal ${label[aksi]} ${berhasil} akun (${dilewati} dilewati)`,
      undefined,
      { ids: targets.map((t) => t.id), role: req.body?.role || null, dilewati: alasanLewat }
    );

    res.status(200).json({
      message: `${label[aksi]} berhasil untuk ${berhasil} akun${dilewati ? `, ${dilewati} dilewati` : ''}.`,
      data: { berhasil, dilewati, alasanLewat },
    });
  } catch (error) {
    next(error);
  }
};

/** Daftar akun yang sedang berada di tempat sampah. */
export const getTrashStudents = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const search = String(req.query.search || '').trim();
    const where: any = {
      deletedAt: { not: null },
      role: { notIn: ['ADMIN', 'SUPERADMIN'] },
    };
    if (search) {
      where.OR = [{ nim: { contains: search } }, { profile: { nama: { contains: search } } }];
    }

    // Paginasi aditif: tanpa `page`/`limit` hasilnya tetap 100 baris pertama
    // seperti sebelumnya, jadi pemanggil lama tidak berubah.
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 100));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          nim: true,
          role: true,
          deletedAt: true,
          deletedById: true,
          deletionReason: true,
          profile: { select: { nama: true, program_studi: true, foto: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      data,
      meta: { total, page, limit, totalPages: batasHalaman(total, limit), hariTempatSampah: HARI_TEMPAT_SAMPAH },
    });
  } catch (error) {
    next(error);
  }
};

export const restoreStudent = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, nim: true, deletedAt: true, role: true, profile: { select: { nama: true } } },
    });

    if (!target || !target.deletedAt) {
      res.status(404).json({ message: 'Akun tidak ditemukan di tempat sampah.' });
      return;
    }
    if (isAdminRole(target.role)) {
      res.status(403).json({ message: 'Akun pengelola tidak dikelola dari tempat sampah ini.' });
      return;
    }

    await restoreStudentAccount(target.id);
    await logActivity(
      req.user.id,
      'RESTORE_STUDENT',
      'User',
      `Memulihkan akun ${target.profile?.nama || target.nim} (${target.nim}) dari tempat sampah`,
      target.id
    );

    res.status(200).json({ message: `Akun ${target.profile?.nama || target.nim} berhasil dipulihkan.` });
  } catch (error) {
    next(error);
  }
};

export const deleteStudentPermanent = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, nim: true, role: true, deletedAt: true, profile: { select: { nama: true } } },
    });

    if (!target || !target.deletedAt) {
      res.status(404).json({ message: 'Akun tidak ditemukan di tempat sampah.' });
      return;
    }
    if (isAdminRole(target.role)) {
      res.status(403).json({ message: 'Akun pengelola tidak dapat dihapus.' });
      return;
    }

    const nama = target.profile?.nama || target.nim;
    await purgeStudentAccount(target.id);
    await logActivity(
      req.user.id,
      'DELETE_STUDENT_PERMANENT',
      'User',
      `Menghapus permanen akun ${nama} (${target.nim}) dari tempat sampah`,
      undefined,
      { nim: target.nim, nama, role: target.role }
    );

    res.status(200).json({ message: `Akun ${nama} (${target.nim}) dihapus permanen.` });
  } catch (error) {
    next(error);
  }
};
