import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole, OFFICER_ROLES } from '../lib/ticket-access';
import { kirimPushKePengguna } from '../services/push.service';

const TIPE_VALID = ['SURAT', 'PROPOSAL'];
const STATUS_VALID = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIARSIPKAN'];

const staf = (role: string): boolean => isAdminRole(role) || OFFICER_ROLES.includes(role);

/** Arsip surat & proposal: daftar untuk pengurus dan admin. */
export const getDocuments = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!staf(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat membuka arsip surat.' });
      return;
    }

    const tipe = String(req.query.type || 'ALL').toUpperCase();
    const status = String(req.query.status || 'ALL').toUpperCase();
    const search = String(req.query.search || '').trim();

    const where: any = {};
    if (TIPE_VALID.includes(tipe)) where.type = tipe;
    if (STATUS_VALID.includes(status)) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { number: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [data, total, diajukan, disetujui] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 150,
        include: {
          createdBy: { select: { nim: true, profile: { select: { nama: true } } } },
          approvedBy: { select: { nim: true, profile: { select: { nama: true } } } },
        },
      }),
      prisma.document.count({ where }),
      prisma.document.count({ where: { status: 'DIAJUKAN' } }),
      prisma.document.count({ where: { status: 'DISETUJUI' } }),
    ]);

    res.status(200).json({ data, meta: { total, diajukan, disetujui } });
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!staf(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat menambah arsip.' });
      return;
    }

    const type = String(req.body?.type || '').toUpperCase();
    const number = String(req.body?.number || '').trim().slice(0, 80);
    const title = String(req.body?.title || '').trim().slice(0, 200);
    const description = String(req.body?.description || '').trim().slice(0, 5000) || null;

    if (!TIPE_VALID.includes(type)) {
      res.status(400).json({ message: 'Jenis dokumen harus SURAT atau PROPOSAL.' });
      return;
    }
    if (!number || !title) {
      res.status(400).json({ message: 'Nomor dan judul dokumen wajib diisi.' });
      return;
    }

    try {
      const data = await prisma.document.create({
        data: {
          type,
          number,
          title,
          description,
          createdById: req.user.id,
          ...(req.file
            ? { fileUrl: `/uploads/${req.file.filename}`, fileName: req.file.originalname }
            : {}),
        },
      });

      await logActivity(
        req.user.id,
        'CREATE_DOCUMENT',
        'Document',
        `Menambahkan ${type} ${number}: ${title}`,
        data.id
      );

      res.status(201).json({ message: 'Dokumen berhasil diarsipkan.', data });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ message: `Nomor ${type} ${number} sudah dipakai.` });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const updateDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!staf(req.user.role)) {
      res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat mengubah arsip.' });
      return;
    }

    const lama = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!lama) {
      res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
      return;
    }
    if (lama.createdById !== req.user.id && !isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya pembuat dokumen atau admin yang dapat mengubahnya.' });
      return;
    }
    if (lama.status === 'DISETUJUI' && !isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Dokumen yang sudah disetujui hanya dapat diubah admin.' });
      return;
    }

    const type = req.body?.type ? String(req.body.type).toUpperCase() : lama.type;
    const number = req.body?.number !== undefined ? String(req.body.number).trim().slice(0, 80) : lama.number;
    const title = req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 200) : lama.title;
    const description =
      req.body?.description !== undefined ? String(req.body.description).trim().slice(0, 5000) || null : lama.description;

    if (!TIPE_VALID.includes(type) || !number || !title) {
      res.status(400).json({ message: 'Jenis, nomor, dan judul dokumen wajib valid.' });
      return;
    }

    const data = await prisma.document.update({
      where: { id: lama.id },
      data: {
        type,
        number,
        title,
        description,
        ...(req.file
          ? { fileUrl: `/uploads/${req.file.filename}`, fileName: req.file.originalname }
          : {}),
      },
    });

    await logActivity(req.user.id, 'UPDATE_DOCUMENT', 'Document', `Mengubah ${type} ${number}`, data.id);
    res.status(200).json({ message: 'Dokumen diperbarui.', data });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ message: 'Nomor dokumen sudah dipakai.' });
      return;
    }
    next(error);
  }
};

/** Pembuat mengajukan dokumen untuk ditinjau admin. */
export const submitDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dokumen = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!dokumen) {
      res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
      return;
    }
    if (dokumen.createdById !== req.user.id && !isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya pembuat dokumen atau admin yang dapat mengajukannya.' });
      return;
    }
    if (!['DRAFT', 'DITOLAK'].includes(dokumen.status)) {
      res.status(400).json({ message: 'Hanya dokumen draf atau yang ditolak yang dapat diajukan.' });
      return;
    }

    const data = await prisma.document.update({
      where: { id: dokumen.id },
      data: { status: 'DIAJUKAN', note: null },
    });

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: 'Dokumen Menunggu Persetujuan',
          message: `${dokumen.type} ${dokumen.number} — ${dokumen.title}`,
        })),
      });
      await Promise.all(
        admins.map((a) =>
          kirimPushKePengguna(a.id, {
            title: 'Dokumen Menunggu Persetujuan',
            body: `${dokumen.type} ${dokumen.number}`,
            url: '/dokumen',
          })
        )
      );
    }

    await logActivity(req.user.id, 'SUBMIT_DOCUMENT', 'Document', `Mengajukan ${dokumen.type} ${dokumen.number}`, dokumen.id);
    res.status(200).json({ message: 'Dokumen diajukan untuk ditinjau admin.', data });
  } catch (error) {
    next(error);
  }
};

export const reviewDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin yang dapat menyetujui atau menolak dokumen.' });
      return;
    }

    const status = String(req.body?.status || '').toUpperCase();
    if (!['DISETUJUI', 'DITOLAK', 'DIARSIPKAN'].includes(status)) {
      res.status(400).json({ message: 'Status tinjauan tidak valid.' });
      return;
    }
    const note = String(req.body?.note || '').trim().slice(0, 2000) || null;

    const dokumen = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!dokumen) {
      res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
      return;
    }

    const data = await prisma.document.update({
      where: { id: dokumen.id },
      data: {
        status,
        note,
        approvedById: req.user.id,
        approvedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: dokumen.createdById,
        title: `Dokumen ${status === 'DISETUJUI' ? 'Disetujui' : status === 'DITOLAK' ? 'Ditolak' : 'Diarsipkan'}`,
        message: `${dokumen.type} ${dokumen.number} — ${dokumen.title}${note ? `: ${note}` : ''}`,
      },
    });
    await kirimPushKePengguna(dokumen.createdById, {
      title: `Dokumen ${status === 'DISETUJUI' ? 'Disetujui' : status === 'DITOLAK' ? 'Ditolak' : 'Diarsipkan'}`,
      body: `${dokumen.type} ${dokumen.number}`,
      url: '/dokumen',
    });

    await logActivity(req.user.id, `REVIEW_DOCUMENT_${status}`, 'Document', `Menandai ${dokumen.type} ${dokumen.number} sebagai ${status}`, dokumen.id);
    res.status(200).json({ message: `Dokumen ditandai ${status}.`, data });
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dokumen = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!dokumen) {
      res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
      return;
    }
    if (!isAdminRole(req.user.role) && (dokumen.createdById !== req.user.id || dokumen.status !== 'DRAFT')) {
      res.status(403).json({ message: 'Hanya admin, atau pembuat dokumen draf, yang dapat menghapusnya.' });
      return;
    }

    await prisma.document.delete({ where: { id: dokumen.id } });
    await logActivity(req.user.id, 'DELETE_DOCUMENT', 'Document', `Menghapus ${dokumen.type} ${dokumen.number}`, dokumen.id);
    res.status(200).json({ message: 'Dokumen dihapus dari arsip.' });
  } catch (error) {
    next(error);
  }
};
