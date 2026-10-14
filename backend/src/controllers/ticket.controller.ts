import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendEmailNotification, generateTicketNotificationEmail } from '../services/email.service';

// 1. Membuat Tiket Baru (Dengan File Attachment Terpisah)
export const createTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type, category, title, content } = req.body;
    
    // Tangkap file jika ada
    const file = req.file;

    if (!type || !category || !title || !content) {
      res.status(400).json({ message: 'Semua field wajib diisi.' });
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const ticket_no = `TKT-${dateStr}-${randomCode}`;

    // Buat Tiket
    const newTicket = await prisma.ticket.create({
      data: {
        ticket_no, type, category, title, content,
        senderId: userId,
        status: 'DIKIRIM',
        moderationStatus: 'PENDING_MODERATION'
      }
    });

    // Jika ada file yang diupload, simpan ke tabel Attachment
    if (file) {
      await prisma.attachment.create({
        data: {
          ticketId: newTicket.id,
          filename: file.filename,
          url: `/uploads/${file.filename}`, // Path URL relatif
          mimeType: file.mimetype,
          size: file.size
        }
      });
    }

    // --- TRIGGER NOTIFIKASI: Buat notifikasi di database ---
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          title: 'Tiket Masuk Baru',
          message: `Tiket ${type} baru #${ticket_no} menunggu untuk ditinjau.`
        }))
      });
    }

    // --- TRIGGER NOTIFIKASI EMAIL: Kirim email ke SEMUA PENGURUS + ADMIN ---
    // HANYA ke email yang sudah diverifikasi. Alamat yang belum terbukti benar
    // tidak boleh dikirimi notifikasi resmi, dan alamat karangan seperti
    // "nim@unaya.ac.id" hanya menghasilkan email pantulan.
    const allOfficers = await prisma.user.findMany({
      where: { role: { in: ['PENGURUS', 'ADMIN'] } },
      include: { profile: { select: { nama: true, email: true, email_verified_at: true } } }
    });

    const officerPenerima = allOfficers.filter(
      (officer) => officer.profile?.email && officer.profile.email_verified_at
    );
    const jumlahDilewati = allOfficers.length - officerPenerima.length;

    if (jumlahDilewati > 0) {
      console.log(
        `ℹ️ Notifikasi email tiket dilewati untuk ${jumlahDilewati} pengurus/admin yang emailnya belum terverifikasi.`
      );
    }

    if (officerPenerima.length > 0) {
      const emailPromises = officerPenerima.map(async (officer) => {
        const recipientName = officer.profile?.nama || officer.nim;
        const recipientEmail = officer.profile!.email as string;
        const htmlContent = generateTicketNotificationEmail(
          recipientName,
          ticket_no,
          type,
          title,
          userId,
          category
        );

        await sendEmailNotification(
          recipientEmail,
          `📬 Tiket Baru: ${ticket_no} - ${title}`,
          htmlContent
        );
      });

      await Promise.all(emailPromises);
    }

    res.status(201).json({ message: 'Tiket berhasil dikirim.', ticket: newTicket });
  } catch (error) { next(error); }
};

// 2. Mengambil Daftar Tiket
export const getTickets = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    let whereCondition: any = {};

    if (user.role === 'MAHASISWA') {
      whereCondition.senderId = user.id;
    }

    const tickets = await prisma.ticket.findMany({
      where: whereCondition,
      include: {
        sender: { select: { nim: true, role: true } },
        attachments: true, // <-- Tambahkan baris ini agar lampiran ditarik ke Frontend
        replies: { include: { author: { select: { nim: true, role: true } } } },
        assignments: {
          where: { isActive: true },
          include: { assignee: { include: { profile: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ data: tickets });
  } catch (error) { next(error); }
};

// 3. Membalas Tiket
export const replyTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) return;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    const reply = await prisma.ticketReply.create({
      data: { ticketId: id, authorId: userId, content }
    });

    // --- TRIGGER NOTIFIKASI: Beritahu Mahasiswa ada balasan ---
    if (ticket.senderId !== userId) {
      await prisma.notification.create({
        data: {
          userId: ticket.senderId,
          title: 'Balasan Baru pada Tiket',
          message: `Tiket #${ticket.ticket_no} Anda telah mendapat balasan baru dari pengurus.`
        }
      });
    }

    res.status(201).json({ message: 'Balasan berhasil dikirim.', reply });
  } catch (error) { next(error); }
};

// 4. MENGAMBIL DAFTAR PENGURUS
export const getAssignees = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pengurus = await prisma.user.findMany({
      where: { role: { in: ['PENGURUS', 'ADMIN'] } },
      select: { id: true, nim: true, role: true, profile: { select: { nama: true } } }
    });
    res.status(200).json({ data: pengurus });
  } catch (error) { next(error); }
};

// 5. DELEGASI TIKET
export const assignTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    const assignerId = req.user.id;

    if (!assigneeId) { res.status(400).json({ message: 'Pengurus wajib dipilih.' }); return; }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    await prisma.ticketAssignment.updateMany({
      where: { ticketId: id, isActive: true },
      data: { isActive: false }
    });

    const newAssignment = await prisma.ticketAssignment.create({
      data: { ticketId: id, assigneeId, assignerId }
    });

    if (ticket.status === 'DIKIRIM') {
      await prisma.ticket.update({ where: { id }, data: { status: 'DIPROSES' } });

      // --- TRIGGER NOTIFIKASI: Beritahu Mahasiswa bahwa tiketnya mulai diproses ---
      await prisma.notification.create({
        data: {
          userId: ticket.senderId,
          title: 'Status Tiket Diperbarui',
          message: `Tiket #${ticket.ticket_no} Anda saat ini mulai diproses oleh pengurus BEM.`
        }
      });
    }

    res.status(200).json({ message: 'Tiket berhasil ditugaskan.', data: newAssignment });
  } catch (error) { next(error); }
};