import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const getDashboardStats = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;

    if (user.role === 'ADMIN' || user.role === 'PENGURUS') {
      // --- STATISTIK UNTUK ADMIN & PENGURUS ---
      const totalMahasiswa = await prisma.user.count({ where: { role: 'MAHASISWA' } });
      const totalPengurus = await prisma.user.count({ where: { role: { in: ['PENGURUS', 'ADMIN'] } } });
      
      const totalAspirasi = await prisma.ticket.count({ where: { type: 'ASPIRASI' } });
      const totalKeluhan = await prisma.ticket.count({ where: { type: 'KELUHAN' } });
      
      const ticketMenunggu = await prisma.ticket.count({ where: { status: 'DIKIRIM' } });
      const ticketDiproses = await prisma.ticket.count({ where: { status: { in: ['DITINJAU', 'DIPROSES'] } } });
      const ticketSelesai = await prisma.ticket.count({ where: { status: 'SELESAI' } });

      res.status(200).json({
        role: user.role,
        data: {
          totalMahasiswa,
          totalPengurus,
          totalAspirasi,
          totalKeluhan,
          ticketMenunggu,
          ticketDiproses,
          ticketSelesai
        }
      });
    } else {
      // --- STATISTIK UNTUK MAHASISWA ---
      const myTickets = await prisma.ticket.count({ where: { senderId: user.id } });
      const myAspirasi = await prisma.ticket.count({ where: { senderId: user.id, type: 'ASPIRASI' } });
      const myKeluhan = await prisma.ticket.count({ where: { senderId: user.id, type: 'KELUHAN' } });
      
      const myActiveTickets = await prisma.ticket.count({ where: { senderId: user.id, status: { not: { in: ['SELESAI', 'DITOLAK'] } } } });
      const myCompletedTickets = await prisma.ticket.count({ where: { senderId: user.id, status: 'SELESAI' } });
      
      res.status(200).json({
        role: user.role,
        data: {
          myTickets,
          myAspirasi,
          myKeluhan,
          myActiveTickets,
          myCompletedTickets
        }
      });
    }
  } catch (error) {
    next(error);
  }
};