import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const BATAS_ONLINE_MS = 90_000;

/** POST /api/presence/heartbeat — memperbarui waktu terakhir pengguna aktif. */
export const heartbeatPresence = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.userPresence.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    });
    res.status(204).end();
  } catch (error) { next(error); }
};

/** GET /api/presence/online — hanya ID diperlukan untuk titik status avatar. */
export const getOnlineUsers = async (_req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hadir = await prisma.userPresence.findMany({
      where: {
        lastSeenAt: { gte: new Date(Date.now() - BATAS_ONLINE_MS) },
        user: { isActive: true, deletedAt: null },
      },
      select: { userId: true },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ data: hadir.map(({ userId }) => userId) });
  } catch (error) { next(error); }
};
