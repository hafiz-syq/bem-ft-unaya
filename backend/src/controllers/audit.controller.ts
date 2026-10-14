import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const getAuditLogs = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
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