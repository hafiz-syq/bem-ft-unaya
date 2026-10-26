import prisma from '../lib/prisma';
import { purgeStudentAccount } from './account-lifecycle.service';

/**
 * Tempat sampah akun mahasiswa.
 *
 * Penghapusan oleh superadmin tidak langsung memusnahkan data. Akun hanya
 * disembunyikan (deletedAt) sehingga masih bisa dipulihkan dalam 30 hari.
 * Job berkala memanggil purgeExpiredTrash untuk menghapus permanen setelahnya.
 */
export const HARI_TEMPAT_SAMPAH = 30;

export async function softDeleteStudentAccount(
  userId: string,
  actorId: string,
  reason?: string | null
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      deletedById: actorId,
      deletionReason: reason?.slice(0, 500) || null,
      isActive: false,
      // Bukan nonaktif-otomatis: jangan sampai job siklus hidup ikut menghapus
      // akun yang sedang menunggu dipulihkan dari tempat sampah.
      deactivationType: 'MANUAL',
      deactivatedAt: new Date(),
      tenggatHapus: null,
      // Naikkan versi sesi agar token lama langsung tidak berlaku.
      sessionVersion: { increment: 1 },
    },
  });
}

export async function restoreStudentAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
      isActive: true,
      deactivatedAt: null,
      deactivationType: null,
      tenggatHapus: null,
      sessionVersion: { increment: 1 },
    },
  });
}

/** Menghapus permanen akun yang sudah lewat 30 hari di tempat sampah. */
export async function purgeExpiredTrash(
  sekarang: Date = new Date()
): Promise<{ akun: number; pesan: number; gagal: string[] }> {
  const batas = new Date(sekarang.getTime() - HARI_TEMPAT_SAMPAH * 24 * 60 * 60 * 1000);

  const akun = await prisma.user.findMany({
    where: {
      deletedAt: { lt: batas },
      role: { notIn: ['ADMIN', 'SUPERADMIN'] },
    },
    select: { id: true, nim: true },
  });

  const gagal: string[] = [];
  let dihapus = 0;
  for (const a of akun) {
    try {
      await purgeStudentAccount(a.id);
      dihapus += 1;
    } catch (error: any) {
      gagal.push(`${a.nim}: ${error?.message || 'gagal'}`);
    }
  }

  const pesan = await prisma.publicComment.deleteMany({
    where: { deletedAt: { lt: batas } },
  });

  return { akun: dihapus, pesan: pesan.count, gagal };
}
