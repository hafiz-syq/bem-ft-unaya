import prisma from '../lib/prisma';
import { logActivity } from './audit.service';
import { kirimEmailNotifikasiPerangkatBaru, type AdminEmailData } from './notifikasi-perangkat-email.service';
import type { Role } from '@prisma/client';

/**
 * Notifikasi atas percobaan login dari perangkat baru.
 *
 * Saat login ditolak karena perangkat lain, admin punya dua saluran:
 * - in-app: notifikasi masuk di halaman Perangkat & Sesi (filter "Menunggu")
 * - email:  kiriman SMTP ke seluruh admin/SUPERADMIN (jika SMTP terisi di .env)
 *
 * Notifikasi hanya dibuat sekali per percobaan — tidak dibuat ulang tiap
 * login yang gagal, supaya tidak spam dan supaya admin tahu ada yang baru.
 */

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;

/**
 * Catat notifikasi in-app ke seluruh ADMIN/SUPERADMIN dan kirim salinan email
 * bila SMTP sudah dikonfigurasi, untuk percobaan perangkat baru yang belum
 * pernah diberitahu sebelumnya.
 *
 * Dipakai pada fungsi login, tepat setelah `pendingDeviceId` berhasil
 * disimpan dan sebelum balasan 403 kembali ke klien.
 */
export const beriNotifikasiPercobaanPerangkat =
  async (targetId: string, aktorId: string, targetNim: string): Promise<void> => {
    // Cek apakah percobaan ini sudah pernah memicu notifikasi sebelumnya.
    // Batas 1 notifikasi per percobaan — tidak spam.
    const terakhir = await prisma.auditLog.findFirst({
      where: {
        action: 'NOTIF_PERANGKAT_BARU',
        metadata: {
          path: ['entityId'],
          equals: targetId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (terakhir) return; // sudah diagkui

    const admins = await prisma.user.findMany({
      where: { role: { in: [...ADMIN_ROLES] as Role[] } },
      select: { id: true, nim: true, email: true },
    });

    const judul = 'Ada percobaan login perangkat baru';
    const pesanMudah =
      'Ada akun yang mencoba login dari perangkat lain. Cek menu Perangkat & Sesi.';

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: judul,
        message: pesanMudah,
        isRead: false,
        createdAt: new Date(),
      })),
      skipDuplicates: true,
    });

    const dataEmail = admins.map((a): AdminEmailData => ({ nim: a.nim, email: a.email }));
    kirimEmailNotifikasiPerangkatBaru(dataEmail, targetNim).catch((err) => {
      console.error('[notif-perangkat-email] gagal kirim email:', err);
    });

    // Catat bahwa kita sudah memberi tahu – supaya tak berulang.
    await logActivity(
      aktorId,
      'NOTIF_PERANGKAT_BARU',
      'System',
      `Notifikasi percobaan perangkat baru dibuat untuk ${admins.length} admin.`,
      targetId,
      {
        notifCount: admins.length,
        notifiedAt: new Date().toISOString(),
      }
    );
  };
