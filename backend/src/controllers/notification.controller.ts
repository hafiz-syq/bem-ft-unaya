import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Mengambil notifikasi user yang sedang login
export const getNotifications = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 15 // Ambil 15 terbaru saja
    });
    res.status(200).json({ data: notifications });
  } catch (error) { next(error); }
};

// Tandai semua notifikasi menjadi sudah dibaca (isRead = true)
export const markAllAsRead = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.status(200).json({ message: 'Semua notifikasi telah dibaca.' });
  } catch (error) { next(error); }
};