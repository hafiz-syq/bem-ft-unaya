import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';

/** Halaman FAQ dashboard. Semua pengguna login boleh membaca; admin mengelola. */

export const getFaqs = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await prisma.faq.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    res.status(200).json({ data });
  } catch (error) { next(error); }
};

export const createFaq = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const question = String(req.body.question || '').trim();
    const answer = String(req.body.answer || '').trim();
    const order = parseInt(req.body.order) || 0;

    if (!question || !answer) {
      res.status(400).json({ message: 'Pertanyaan dan jawaban wajib diisi.' });
      return;
    }

    const baru = await prisma.faq.create({ data: { question, answer, order } });

    await logActivity(req.user.id, 'CREATE_FAQ', 'Faq', `Menambahkan FAQ "${question}"`, baru.id);

    res.status(201).json({ message: 'FAQ berhasil ditambahkan.', data: baru });
  } catch (error) { next(error); }
};

export const updateFaq = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { question, answer, order } = req.body;

    const lama = await prisma.faq.findUnique({ where: { id } });
    if (!lama) { res.status(404).json({ message: 'FAQ tidak ditemukan.' }); return; }

    const updated = await prisma.faq.update({
      where: { id },
      data: {
        ...(question !== undefined ? { question } : {}),
        ...(answer !== undefined ? { answer } : {}),
        ...(order !== undefined ? { order: parseInt(order) || 0 } : {})
      }
    });

    await logActivity(req.user.id, 'UPDATE_FAQ', 'Faq', `Memperbarui FAQ "${updated.question}"`, id);

    res.status(200).json({ message: 'FAQ berhasil diperbarui.', data: updated });
  } catch (error) { next(error); }
};

export const deleteFaq = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lama = await prisma.faq.findUnique({ where: { id: req.params.id } });
    await prisma.faq.delete({ where: { id: req.params.id } });
    await logActivity(
      req.user.id, 'DELETE_FAQ', 'Faq',
      `Menghapus FAQ "${lama?.question ?? req.params.id}"`, req.params.id
    );
    res.status(200).json({ message: 'FAQ berhasil dihapus.' });
  } catch (error) { next(error); }
};
