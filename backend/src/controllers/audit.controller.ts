import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';
import { logActivity } from '../services/audit.service';

/** Batas halaman log yang boleh diminta klien (dipakai tombol "lihat lebih banyak"). */
const BATAS_MAKSIMAL = 100;

/** Umur log minimum (hari) yang boleh dihapus massal oleh ADMIN. */
const UMUR_MINIMUM_HAPUS_ADMIN = 7;

export const getAuditLogs = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // [PERBAIKAN KEAMANAN] Log audit hanya boleh dibaca ADMIN/SUPERADMIN.
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(BATAS_MAKSIMAL, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          actor: {
            include: {
              profile: true // Menggunakan include penuh agar lebih aman untuk Prisma
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count()
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      data: logs,
      meta: { total, page, limit, totalPages }
    });
  } catch (error: any) {
    // Menampilkan error asli di terminal backend Anda
    console.error("==== ERROR DI AUDIT CONTROLLER ====");
    console.error(error.message || error);
    
    res.status(500).json({ message: 'Terjadi kesalahan internal pada server backend.' });
  }
};

/**
 * Menghapus SATU entri log. Hanya SUPERADMIN.
 *
 * Log lain tidak ikut terhapus, dan penghapusan itu sendiri dicatat sebagai log
 * baru — jejak "siapa menghapus apa" tidak boleh ikut hilang.
 */
export const hapusLogAudit = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Hanya SUPERADMIN yang boleh menghapus log satu per satu.' });
      return;
    }

    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      select: { id: true, action: true },
    });

    if (!log) {
      res.status(404).json({ message: 'Log tidak ditemukan.' });
      return;
    }

    await prisma.auditLog.delete({ where: { id: log.id } });

    await logActivity(
      req.user.id,
      'DELETE_AUDIT_LOG',
      'AuditLog',
      `Menghapus satu log aktivitas (${log.action})`,
      log.id
    );

    res.status(200).json({ message: 'Log aktivitas dihapus.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Menghapus log secara massal saat tabelnya sudah terlalu besar.
 *
 * Aturan peran:
 * - ADMIN hanya boleh menghapus log lama (minimal 7 hari, bawaan 30 hari).
 *   Log terbaru tetap ada supaya aktivitas hari ini tidak bisa dihapus admin.
 * - SUPERADMIN boleh menghapus semuanya lewat `semua=true`.
 *
 * Keduanya dicatat sebagai satu log ringkasan berisi jumlah yang dihapus.
 */
export const hapusLogAuditMassal = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const semua = String(req.query.semua ?? req.body?.semua ?? '') === 'true';
    if (semua && req.user.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Hanya SUPERADMIN yang boleh menghapus seluruh log.' });
      return;
    }

    const diminta = parseInt(String(req.query.hari ?? req.body?.hari ?? '30'), 10);
    const hari = Math.max(UMUR_MINIMUM_HAPUS_ADMIN, Number.isFinite(diminta) ? diminta : 30);

    const where = semua
      ? {}
      : { createdAt: { lt: new Date(Date.now() - hari * 24 * 60 * 60 * 1000) } };

    const jumlah = await prisma.auditLog.count({ where });

    if (jumlah === 0) {
      res.status(200).json({
        message: semua
          ? 'Belum ada log yang bisa dihapus.'
          : `Tidak ada log yang lebih lama dari ${hari} hari.`,
        jumlah: 0,
      });
      return;
    }

    await prisma.auditLog.deleteMany({ where });

    await logActivity(
      req.user.id,
      'DELETE_AUDIT_LOG_MASSAL',
      'AuditLog',
      semua
        ? `Menghapus seluruh log aktivitas (${jumlah} entri)`
        : `Menghapus ${jumlah} log aktivitas yang lebih lama dari ${hari} hari`,
      undefined,
      { jumlah, semua, hari: semua ? null : hari }
    );

    res.status(200).json({
      message: semua
        ? `Seluruh log aktivitas (${jumlah} entri) dihapus.`
        : `${jumlah} log yang lebih lama dari ${hari} hari dihapus.`,
      jumlah,
    });
  } catch (error) {
    next(error);
  }
};