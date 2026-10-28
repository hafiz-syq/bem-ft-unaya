import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';
import { kirimPushKePengguna } from '../services/push.service';
import {
  bolehAksesArsip,
  bolehPilihArahSurat,
  cakupanArsipPengguna,
  isArahSurat,
  whereCakupanArsip,
  type ArahSurat,
} from '../lib/arsip-surat';

const TIPE_VALID = ['SURAT', 'PROPOSAL'];
const STATUS_VALID = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIARSIPKAN'];

/**
 * Batas akses arsip surat: pimpinan inti (Ketua/Wakil Ketua/Sekretaris
 * BEM & himpunan, Ketua DPM) serta admin/superadmin. Bukan seluruh pengurus.
 *
 * Mengembalikan true bila permintaan sudah ditolak, sehingga pemanggil cukup
 * menulis `if (await tolakBukanPimpinan(req, res)) return;`.
 */
const tolakBukanPimpinan = async (req: any, res: Response): Promise<boolean> => {
  if (await bolehAksesArsip(req.user)) return false;

  res.status(403).json({
    message:
      'Arsip surat hanya dapat dibuka oleh Ketua, Wakil Ketua, dan Sekretaris BEM/himpunan, Ketua DPM, serta admin.',
  });
  return true;
};

/** Menentukan arah surat dari input; hanya admin yang boleh memilih. */
const arahDariInput = (role: string, nilai: unknown, bawaan: ArahSurat): ArahSurat => {
  if (!bolehPilihArahSurat(role)) return 'KELUAR';
  return isArahSurat(nilai) ? nilai : bawaan;
};

/**
 * GET /api/documents/akses
 *
 * Dipakai sidebar dan halaman arsip untuk tahu apakah menu perlu ditampilkan.
 * Penjagaan sebenarnya tetap di setiap endpoint arsip, bukan di sini.
 */
export const getAksesArsip = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bolehAkses = await bolehAksesArsip(req.user);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      bolehAkses,
      bolehArah: bolehAkses && bolehPilihArahSurat(req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Arsip surat & proposal: daftar untuk pimpinan inti dan admin.
 *
 * Daftar dan seluruh hitungannya selalu dipagat cakupan pengguna (lihat
 * lib/arsip-surat.ts): surat hanya terlihat oleh organisasi pengunggahnya
 * dan tingkat di atasnya — surat DPM hanya untuk DPM & admin, surat BEM juga
 * untuk DPM & admin, surat himpunan juga untuk himpunan itu, BEM, DPM, dan
 * admin. Surat tanpa organisasi hanya untuk admin dan pembuatnya.
 */
export const getDocuments = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (await tolakBukanPimpinan(req, res)) return;
    const cakupan = await cakupanArsipPengguna(req.user);

    const tipe = String(req.query.type || 'ALL').toUpperCase();
    const status = String(req.query.status || 'ALL').toUpperCase();
    const search = String(req.query.search || '').trim();
    const organizationId = String(req.query.organizationId || '').trim();
    const arah = String(req.query.direction || '').toUpperCase();

    // Penyaring dasar dipakai juga untuk hitungan per arah, supaya angka di
    // kedua tab tetap konsisten dengan penyaring organisasi/jenis/pencarian.
    // Cakupan ditaruh di dalam AND agar tidak menimpa penyaring lain.
    const where: any = { AND: [whereCakupanArsip(cakupan, req.user.id)] };
    if (TIPE_VALID.includes(tipe)) where.type = tipe;
    if (STATUS_VALID.includes(status)) where.status = status;
    if (organizationId === 'TANPA') {
      // Surat lama yang belum diberi organisasi.
      where.AND.push({ organizationId: null });
    } else if (organizationId && organizationId !== 'ALL') {
      where.AND.push({ organizationId });
    }
    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search } },
          { number: { contains: search } },
          { description: { contains: search } },
        ],
      });
    }

    // Pemilah surat masuk/keluar hanya berlaku untuk admin & superadmin.
    const bolehArah = bolehPilihArahSurat(req.user.role);
    const whereArah = bolehArah && isArahSurat(arah) ? { ...where, direction: arah } : where;

    const [data, total, diajukan, disetujui, masuk, keluar, organisasi] = await Promise.all([
      prisma.document.findMany({
        where: whereArah,
        orderBy: { createdAt: 'desc' },
        take: 150,
        include: {
          organization: { select: { id: true, name: true } },
          createdBy: { select: { nim: true, profile: { select: { nama: true } } } },
          approvedBy: { select: { nim: true, profile: { select: { nama: true } } } },
        },
      }),
      prisma.document.count({ where: whereArah }),
      prisma.document.count({ where: { ...whereArah, status: 'DIAJUKAN' } }),
      prisma.document.count({ where: { ...whereArah, status: 'DISETUJUI' } }),
      prisma.document.count({ where: { ...where, direction: 'MASUK' } }),
      prisma.document.count({ where: { ...where, direction: 'KELUAR' } }),
      prisma.organization.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      data,
      meta: {
        total,
        diajukan,
        disetujui,
        bolehArah,
        arah: bolehArah ? { masuk, keluar } : null,
        // Daftar organisasi hanya berisi yang boleh dilihat pengguna, supaya
        // pemilah tidak menawarkan organisasi yang hasilnya pasti kosong.
        organisasi: cakupan.admin
          ? organisasi
          : organisasi.filter((o) => cakupan.organisasiTerlihat.includes(o.id)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (await tolakBukanPimpinan(req, res)) return;

    const type = String(req.body?.type || '').toUpperCase();
    const number = String(req.body?.number || '').trim().slice(0, 80);
    const title = String(req.body?.title || '').trim().slice(0, 200);
    const description = String(req.body?.description || '').trim().slice(0, 5000) || null;
    let organizationId = String(req.body?.organizationId || '').trim() || null;
    const direction = arahDariInput(req.user.role, req.body?.direction, 'KELUAR');

    if (!TIPE_VALID.includes(type)) {
      res.status(400).json({ message: 'Jenis dokumen harus SURAT atau PROPOSAL.' });
      return;
    }
    if (!number || !title) {
      res.status(400).json({ message: 'Nomor dan judul dokumen wajib diisi.' });
      return;
    }

    // Organisasi hanya boleh diisi bila benar-benar ada; nilai asing ditolak
    // agar arsip tidak menyimpan relasi yatim.
    if (organizationId) {
      const organisasi = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!organisasi) {
        res.status(400).json({ message: 'Organisasi yang dipilih tidak ditemukan.' });
        return;
      }
    }

    // Pengurus yang lupa memilih organisasi otomatis memakai organisasi
    // kepengurusannya (bila hanya satu), supaya suratnya langsung masuk ruang
    // lingkup arsip organisasi tersebut, bukan tersembunyi sebagai surat tanpa
    // organisasi. Admin yang tidak memilih tetap mendapat surat tanpa
    // organisasi seperti sebelumnya.
    if (!organizationId && !isAdminRole(req.user.role)) {
      const cakupan = await cakupanArsipPengguna(req.user);
      if (cakupan.organisasiSendiri.length === 1) {
        organizationId = cakupan.organisasiSendiri[0];
      }
    }

    try {
      const data = await prisma.document.create({
        data: {
          type,
          number,
          title,
          description,
          organizationId,
          direction,
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
    if (await tolakBukanPimpinan(req, res)) return;

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

    // Arah hanya admin yang boleh diubah; pengurus lain tidak bisa memindahkan
    // surat dari keluar ke masuk (atau sebaliknya).
    const direction = bolehPilihArahSurat(req.user.role)
      ? arahDariInput(req.user.role, req.body?.direction, 'KELUAR')
      : undefined;

    let organizationId = lama.organizationId;
    if (req.body?.organizationId !== undefined) {
      const nilai = String(req.body.organizationId || '').trim() || null;
      if (nilai) {
        const organisasi = await prisma.organization.findUnique({
          where: { id: nilai },
          select: { id: true },
        });
        if (!organisasi) {
          res.status(400).json({ message: 'Organisasi yang dipilih tidak ditemukan.' });
          return;
        }
      }
      organizationId = nilai;
    }

    const data = await prisma.document.update({
      where: { id: lama.id },
      data: {
        type,
        number,
        title,
        description,
        organizationId,
        ...(direction ? { direction } : {}),
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
    if (await tolakBukanPimpinan(req, res)) return;

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
    if (await tolakBukanPimpinan(req, res)) return;

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
