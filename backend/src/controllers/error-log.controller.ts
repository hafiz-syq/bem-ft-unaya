import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';
import { logActivity } from '../services/audit.service';

export const getErrorLogs = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin yang dapat melihat pemantauan kesalahan.' });
      return;
    }

    const status = String(req.query.status || 'OPEN').toUpperCase();
    const where: any = {};
    if (status === 'OPEN') where.resolvedAt = null;
    else if (status === 'RESOLVED') where.resolvedAt = { not: null };

    const [data, terbuka, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.errorLog.count({ where: { resolvedAt: null } }),
      prisma.errorLog.count(),
    ]);

    res.status(200).json({ data, meta: { terbuka, total } });
  } catch (error) {
    next(error);
  }
};

export const resolveErrorLog = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin yang dapat menandai kesalahan selesai.' });
      return;
    }

    const log = await prisma.errorLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      res.status(404).json({ message: 'Catatan kesalahan tidak ditemukan.' });
      return;
    }

    const resolvedAt = req.body?.resolved === false ? null : new Date();
    await prisma.errorLog.update({ where: { id: log.id }, data: { resolvedAt } });

    await logActivity(
      req.user.id,
      'RESOLVE_ERROR_LOG',
      'ErrorLog',
      `${resolvedAt ? 'Menandai selesai' : 'Membuka kembali'} kesalahan ${log.method} ${log.path}`,
      log.id
    );

    res.status(200).json({ message: resolvedAt ? 'Kesalahan ditandai selesai.' : 'Kesalahan dibuka kembali.' });
  } catch (error) {
    next(error);
  }
};

export const clearResolvedErrors = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Hanya superadmin yang dapat membersihkan riwayat kesalahan.' });
      return;
    }
    const hasil = await prisma.errorLog.deleteMany({ where: { resolvedAt: { not: null } } });
    res.status(200).json({ message: `${hasil.count} catatan kesalahan selesai dibersihkan.` });
  } catch (error) {
    next(error);
  }
};
