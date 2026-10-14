import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Publik (Tamu) mengirim pesan / komentar
export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { nama, asal_kampus, email, no_hp, content } = req.body;

    if (!nama || !asal_kampus || !email || !no_hp || !content) {
      res.status(400).json({ message: 'Semua kolom wajib diisi.' });
      return;
    }

    const newComment = await prisma.publicComment.create({
      data: { nama, asal_kampus, email, no_hp, content }
    });

    res.status(201).json({ message: 'Pesan berhasil dikirim. Terima kasih telah menghubungi kami!', data: newComment });
  } catch (error) {
    next(error);
  }
};

// TAMBAHAN: Mengambil data komentar (Untuk Landing & Admin)
export const getPublicComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const comments = await prisma.publicComment.findMany({
      orderBy: { createdAt: 'desc' } // Mengurutkan dari yang paling baru
    });
    res.status(200).json({ data: comments });
  } catch (error) { 
    next(error); 
  }
};