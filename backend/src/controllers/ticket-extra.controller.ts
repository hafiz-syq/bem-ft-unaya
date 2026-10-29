import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { canAccessTicket, isAdminRole, OFFICER_ROLES } from '../lib/ticket-access';
import { kirimPushKePengguna } from '../services/push.service';

const PRIORITAS = ['RENDAH', 'NORMAL', 'TINGGI', 'MENDESAK'] as const;
type Prioritas = (typeof PRIORITAS)[number];

/** Tenggat respons pertama (jam) untuk setiap tingkat prioritas. */
export const SLA_JAM: Record<Prioritas, number> = {
  MENDESAK: 4,
  TINGGI: 12,
  NORMAL: 24,
  RENDAH: 48,
};

/** Menghitung tenggat SLA dari waktu masuk dan prioritas tiket. */
export const hitungTenggatSla = (createdAt: Date, priority: string | null | undefined): Date =>
  new Date(createdAt.getTime() + SLA_JAM[(priority as Prioritas) || 'NORMAL'] * 60 * 60 * 1000);

export const setTicketPriority = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Prioritas menentukan tenggat SLA dan merupakan alat kerja pengurus, bukan
    // kendali pengirim. Tanpa penjagaan ini mahasiswa bisa menaikkan prioritas
    // tiketnya sendiri lewat API. Diletakkan sebelum validasi body agar peran
    // yang tidak berhak tidak ikut menerima petunjuk isi permintaan yang sah.
    // Kepemilikan/akses tiket tetap diperiksa di bawah lewat canAccessTicket.
    if (!isAdminRole(req.user.role) && !OFFICER_ROLES.includes(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat mengubah prioritas tiket.' });
      return;
    }

    const priority = String(req.body?.priority || '').toUpperCase() as Prioritas;
    if (!PRIORITAS.includes(priority)) {
      res.status(400).json({ message: 'Prioritas tidak dikenali.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { assignments: { where: { isActive: true } } },
    });
    if (!ticket) {
      res.status(404).json({ message: 'Tiket tidak ditemukan.' });
      return;
    }
    if (!canAccessTicket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak berhak mengubah prioritas tiket ini.' });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { priority },
    });

    await logActivity(
      req.user.id,
      'UPDATE_TICKET_PRIORITY',
      'Ticket',
      `Mengubah prioritas tiket #${ticket.ticket_no} menjadi ${priority}`,
      ticket.id,
      { prioritasLama: ticket.priority, prioritasBaru: priority }
    );

    res.status(200).json({ message: `Prioritas tiket diubah menjadi ${priority}.`, data: updated });
  } catch (error) {
    next(error);
  }
};

/** Pengirim menilai tiketnya sendiri yang sudah SELESAI (1–5). */
export const rateTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rating = Number(req.body?.rating);
    const komentar = String(req.body?.comment || '').trim().slice(0, 1000);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Penilaian harus berupa angka 1 sampai 5.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: { id: true, ticket_no: true, senderId: true, status: true, rating: true },
    });
    if (!ticket) {
      res.status(404).json({ message: 'Tiket tidak ditemukan.' });
      return;
    }
    if (ticket.senderId !== req.user.id) {
      res.status(403).json({ message: 'Hanya pengirim tiket yang dapat memberi penilaian.' });
      return;
    }
    if (ticket.status !== 'SELESAI') {
      res.status(400).json({ message: 'Penilaian hanya dapat diberikan setelah tiket selesai.' });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { rating, ratingComment: komentar || null, ratedAt: new Date() },
    });

    await logActivity(
      req.user.id,
      'RATE_TICKET',
      'Ticket',
      `Memberi penilaian ${rating}/5 untuk tiket #${ticket.ticket_no}`,
      ticket.id,
      { rating }
    );

    res.status(201).json({ message: 'Terima kasih, penilaian Anda tersimpan.', data: updated });
  } catch (error) {
    next(error);
  }
};

const bolehKelolaTemplate = (role: string): boolean =>
  isAdminRole(role) || OFFICER_ROLES.includes(role);

export const getTicketTemplates = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaTemplate(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat memakai template.' });
      return;
    }
    const data = await prisma.ticketTemplate.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, content: true, createdById: true, updatedAt: true },
    });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const createTicketTemplate = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaTemplate(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat membuat template.' });
      return;
    }
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const content = String(req.body?.content || '').trim().slice(0, 5000);
    if (!title || !content) {
      res.status(400).json({ message: 'Judul dan isi template wajib diisi.' });
      return;
    }

    const data = await prisma.ticketTemplate.create({
      data: { title, content, createdById: req.user.id },
    });
    await logActivity(req.user.id, 'CREATE_TICKET_TEMPLATE', 'TicketTemplate', `Membuat template "${title}"`, data.id);
    res.status(201).json({ message: 'Template balasan dibuat.', data });
  } catch (error) {
    next(error);
  }
};

export const updateTicketTemplate = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaTemplate(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat mengubah template.' });
      return;
    }
    const data = await prisma.ticketTemplate.findUnique({ where: { id: req.params.id } });
    if (!data) {
      res.status(404).json({ message: 'Template tidak ditemukan.' });
      return;
    }
    if (data.createdById !== req.user.id && !isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya pembuat template atau admin yang dapat mengubahnya.' });
      return;
    }

    const title = String(req.body?.title ?? data.title).trim().slice(0, 120);
    const content = String(req.body?.content ?? data.content).trim().slice(0, 5000);
    if (!title || !content) {
      res.status(400).json({ message: 'Judul dan isi template tidak boleh kosong.' });
      return;
    }

    const updated = await prisma.ticketTemplate.update({
      where: { id: data.id },
      data: { title, content },
    });
    res.status(200).json({ message: 'Template diperbarui.', data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteTicketTemplate = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaTemplate(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat menghapus template.' });
      return;
    }
    const data = await prisma.ticketTemplate.findUnique({ where: { id: req.params.id } });
    if (!data) {
      res.status(404).json({ message: 'Template tidak ditemukan.' });
      return;
    }
    if (data.createdById !== req.user.id && !isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya pembuat template atau admin yang dapat menghapusnya.' });
      return;
    }

    await prisma.ticketTemplate.update({ where: { id: data.id }, data: { isActive: false } });
    res.status(200).json({ message: 'Template dihapus dari daftar.' });
  } catch (error) {
    next(error);
  }
};

/** Dipakai controller tiket utama untuk memberi tahu pengirim lewat browser. */
export const beritahuPengirim = async (
  userId: string,
  title: string,
  body: string,
  url = '/tickets'
): Promise<void> => {
  try {
    await kirimPushKePengguna(userId, { title, body, url });
  } catch (error) {
    console.error('Gagal mengirim notifikasi browser:', error);
  }
};
