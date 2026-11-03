import { Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { hapusLampiran, simpanLampiran, type HasilLampiran } from '../lib/lampiran';
import { logActivity } from '../services/audit.service';
import { sendEmailNotification, generateTicketNotificationEmail } from '../services/email.service';
import { kirimPushKeBanyak, kirimPushKePengguna } from '../services/push.service';
import { hitungTenggatSla } from './ticket-extra.controller';
import {
  ADMIN_ROLES,
  OFFICER_ROLES,
  ROLE_TARGET,
  TARGET_LABEL,
  canAccessTicket,
  canExportKeluhan,
  isAdminRole,
  isOfficer,
  bolehMemoderasiTiket,
  isTicketTarget,
  ticketVisibilityWhere,
  type TicketTarget,
} from '../lib/ticket-access';

/**
 * Role minimum yang boleh melepas penugasan dan menghapus tiket.
 * DPM dianggap tingkat tertinggi di organisasi, sehingga BEM dan himpunan
 * tidak termasuk. Admin & superadmin selalu boleh.
 */
const ROLE_HAPUS_TIKET = ['PENGURUS_DPM', 'ADMIN', 'SUPERADMIN'];
const bolehHapusTiket = (role: string | undefined): boolean =>
  !!role && ROLE_HAPUS_TIKET.includes(role);

/**
 * Nomor tiket berikutnya = nomor tertinggi hari itu + 1, bukan jumlah baris hari itu.
 * DeleteTicket hard delete, jadi satu penghapusan membuat count lebih kecil dari
 * nomor tertinggi dan semua tiket sesudahnya menabrak unique constraint ticket_no.
 * shortcut: bukti EXPLAIN B2.1 untuk "hitung nomor tiket harian" (count pada
 * Ticket_createdAt_idx, rows=63) TIDAK berlaku lagi — query sekarang rentang indeks
 * unik ticket_no. Ticket_createdAt_idx tetap dipertahankan untuk jendela 2.000 tiket
 * di dashboard-statistik.
 */
export async function nomorTiketBerikutnya(
  tx: Prisma.TransactionClient,
  hariUtc: string
): Promise<string> {
  const [b] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ticket_no, '-', -1) AS UNSIGNED)), 0) AS n
    FROM Ticket WHERE ticket_no LIKE ${`TKT-${hariUtc}-%`}`;
  return `TKT-${hariUtc}-${String(Number(b?.n ?? 0n) + 1).padStart(4, '0')}`;
}

/**
 * Menentukan siapa yang mendapat notifikasi (database + email) untuk sebuah tiket.
 * Notifikasi hanya menyasar pengurus yang memang berhak membaca tiket tersebut,
 * bukan seluruh pengurus seperti sebelumnya.
 */
const roleYangMenerima = (type: string, target: TicketTarget | null): string[] => {
  const roles: string[] = [...ADMIN_ROLES];

  if (type === 'KELUHAN' && target && target !== 'BEM') {
    const peran = Object.keys(ROLE_TARGET).find((r) => ROLE_TARGET[r] === target);
    if (peran) roles.push(peran);
  } else {
    // Aspirasi (dan keluhan yang diarahkan ke BEM) menjadi tugas PENGURUS BEM.
    roles.push('PENGURUS_BEM');
  }

  return roles;
};

// 1. Membuat Tiket Baru (dengan lampiran opsional)
export const createTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type, category, title, content } = req.body;
    const file = req.file;

    if (!type || !category || !title || !content) {
      res.status(400).json({ message: 'Semua field wajib diisi.' });
      return;
    }

    if (type !== 'ASPIRASI' && type !== 'KELUHAN') {
      res.status(400).json({ message: 'Jenis tiket tidak dikenali.' });
      return;
    }

    // Aspirasi selalu menuju BEM. Keluhan wajib memilih organisasi tujuan.
    let targetOrganization: TicketTarget = 'BEM';
    if (type === 'KELUHAN') {
      const dipilih = req.body.targetOrganization;
      if (!isTicketTarget(dipilih)) {
        res.status(400).json({ message: 'Pilih organisasi tujuan keluhan terlebih dahulu.' });
        return;
      }
      targetOrganization = dipilih;
    }

    // Berkas disimpan ke penyimpanan awan SEBELUM tiket dibuat supaya kegagalan
    // penyimpanan tidak meninggalkan tiket yang menjanjikan lampiran tak ada.
    const lampiranBaru: HasilLampiran | null = file ? await simpanLampiran(file) : null;

    const roles = roleYangMenerima(type, targetOrganization);
    const penerima = await prisma.user.findMany({
      where: { role: { in: roles as any }, isActive: true },
      select: { id: true },
    });

    // Unique constraint pada ticket_no adalah penjaga sebenarnya: dua pengiriman
    // serentak menghasilkan P2002 yang dijawab 409, bukan tiket bernomor ganda.
    // shortcut: sengaja TANPA isolationLevel Serializable — diukur 12 kirim
    // serentak, Serializable cuma meloloskan 1 (11x P2034 = 500), default
    // meloloskan 1 dan sisanya P2002 = 409 yang bisa diminta ulang.
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    let newTicket: { id: string; ticket_no: string };
    try {
      newTicket = await prisma.$transaction(
        async (tx) => {
          const ticket_no = await nomorTiketBerikutnya(tx, dateStr);

          const tiket = await tx.ticket.create({
            data: {
              ticket_no,
              type,
              category,
              title,
              content,
              targetOrganization,
              senderId: userId,
              status: 'DIKIRIM',
              // Aspirasi memang ditujukan untuk ruang publik sejak awal.
              // Keluhan ditahan dulu supaya bisa diperiksa sebelum tayang (anonim).
              moderationStatus: type === 'ASPIRASI' ? 'PUBLISHED' : 'PENDING_MODERATION',
            },
          });

          if (lampiranBaru) {
            await tx.attachment.create({
              data: {
                ticketId: tiket.id,
                filename: lampiranBaru.filename,
                url: lampiranBaru.url,
                mimeType: lampiranBaru.mimeType,
                size: lampiranBaru.size,
              },
            });
          }

          if (penerima.length > 0) {
            await tx.notification.createMany({
              data: penerima.map((p) => ({
                userId: p.id,
                title: 'Tiket Masuk Baru',
                message: `Tiket ${type} baru #${ticket_no} menunggu untuk ditinjau.`,
              })),
            });
          }

          return tiket;
        }
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ message: 'Nomor tiket baru sedang dipakai, silakan kirim ulang.' });
        return;
      }
      throw error;
    }

    const ticket_no = newTicket.ticket_no;

    // --- Notifikasi dalam aplikasi (dikirim setelah commit) ---
    if (penerima.length > 0) {
      await kirimPushKeBanyak(
        penerima.map((p) => p.id),
        {
          title: 'Tiket Masuk Baru',
          body: `Tiket ${type} baru #${ticket_no} menunggu untuk ditinjau.`,
          url: '/tickets',
        }
      ).catch(() => undefined);
    }

    // --- Notifikasi email: HANYA ke alamat yang sudah diverifikasi ---
    const allOfficers = await prisma.user.findMany({
      where: { role: { in: roles as any }, isActive: true },
      include: { profile: { select: { nama: true, email: true, email_verified_at: true } } },
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
      await Promise.all(
        officerPenerima.map(async (officer) => {
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
        })
      );
    }

    res.status(201).json({ message: 'Tiket berhasil dikirim.', ticket: newTicket });
  } catch (error) { next(error); }
};

// 2. Mengambil Daftar Tiket (dibatasi hak baca per organisasi)
export const getTickets = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: ticketVisibilityWhere(req.user),
      include: {
        // id & foto ikut dikirim supaya avatar pengirim/petugas bisa membuka
        // dialog profil tanpa permintaan tambahan.
        sender: { select: { id: true, nim: true, role: true, foto: true, profile: { select: { nama: true } } } },
        // shortcut: 30 lampiran & 200 balasan terbaru per tiket, naikkan bila ada
        // tiket yang benar-benar melewati itu. GET /tickets adalah satu-satunya
        // sumber utas (tidak ada endpoint detail), jadi batas harus cukup longgar
        // supaya tidak menghapus baris dari layar — hanya memotong pertumbuhan
        // payload yang tidak masuk akal.
        attachments: { orderBy: { createdAt: 'desc' }, take: 30 },
        replies: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: {
            author: { select: { id: true, nim: true, role: true, foto: true, profile: { select: { nama: true } } } },
          },
        },
        assignments: {
          where: { isActive: true },
          include: {
            assignee: {
              select: { id: true, nim: true, role: true, foto: true, profile: { select: { nama: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // SLA dihitung di server supaya halaman dan ekspor memakai acuan yang sama.
    const data = tickets.map((t) => {
      const tenggat = hitungTenggatSla(t.createdAt, t.priority);
      const terlambat =
        !t.firstResponseAt &&
        t.status !== 'SELESAI' &&
        t.status !== 'DITOLAK' &&
        Date.now() > tenggat.getTime();
      return {
        ...t,
        // replies diambil terbaru dulu karena take; dibalik agar urutan tampil
        // tetap kronologis seperti utas sebelumnya.
        replies: [...t.replies].reverse(),
        slaDueAt: tenggat,
        slaOverdue: terlambat,
      };
    });

    res.status(200).json({ data });
  } catch (error) { next(error); }
};

// 3. Feed publik untuk landing page.
//    Aspirasi tampil dengan nama & NIM pengirim; keluhan selalu dianonimkan.
export const getPublicTickets = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 30);

    const tickets = await prisma.ticket.findMany({
      where: { moderationStatus: 'PUBLISHED', type: { in: ['ASPIRASI', 'KELUHAN'] } },
      include: {
        // Aspirasi memang tampil dengan identitas, jadi foto profilnya ikut agar
        // pengunjung yang login bisa membuka profil pengirim dari kartu publik.
        sender: { select: { id: true, nim: true, foto: true, profile: { select: { nama: true, foto: true } } } },
        replies: {
          where: { author: { role: { in: [...ADMIN_ROLES, ...OFFICER_ROLES] as any } } },
          select: { id: true, content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const data = tickets.map((t) => {
      const anonim = t.type === 'KELUHAN';
      return {
        id: t.id,
        ticket_no: anonim ? null : t.ticket_no,
        type: t.type,
        category: t.category,
        title: t.title,
        content: t.content,
        targetOrganization: t.targetOrganization,
        targetLabel: t.targetOrganization
          ? TARGET_LABEL[t.targetOrganization as TicketTarget]
          : null,
        status: t.status,
        createdAt: t.createdAt,
        pengirim: anonim
          ? null
          : {
              id: t.sender.id,
              nama: t.sender.profile?.nama ?? null,
              nim: t.sender.nim,
              foto: t.sender.foto ?? t.sender.profile?.foto ?? null,
            },
        anonim,
        balasan: t.replies,
      };
    });

    res.status(200).json({ data });
  } catch (error) { next(error); }
};

// 4. Membalas Tiket (wajib punya hak baca atas tiket tersebut)
export const replyTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ message: 'Isi balasan tidak boleh kosong.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { assignments: { where: { isActive: true } } },
    });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    if (!canAccessTicket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak memiliki akses ke tiket ini.' });
      return;
    }

    const reply = await prisma.$transaction(async (tx) => {
      const baru = await tx.ticketReply.create({ data: { ticketId: id, authorId: userId, content } });
      if (ticket.senderId === userId) return baru;

      // Balasan pertama pengurus menghentikan jam SLA dan memindahkan tiket ke
      // DIPROSES bila sebelumnya masih menunggu.
      const perubahan: Record<string, unknown> = {};
      if (!ticket.firstResponseAt) perubahan.firstResponseAt = new Date();
      if (ticket.status === 'DIKIRIM' || ticket.status === 'DITINJAU') perubahan.status = 'DIPROSES';
      if (Object.keys(perubahan).length > 0) {
        await tx.ticket.update({ where: { id }, data: perubahan });
      }

      await tx.notification.create({
        data: {
          userId: ticket.senderId,
          title: 'Balasan Baru pada Tiket',
          message: `Tiket #${ticket.ticket_no} Anda telah mendapat balasan baru dari pengurus.`,
        },
      });
      return baru;
    });

    // Push di luar transaksi: efek samping jaringan tidak dibatalkan oleh rollback.
    if (ticket.senderId !== userId) {
      await kirimPushKePengguna(ticket.senderId, {
        title: 'Balasan Baru pada Tiket',
        body: `Tiket #${ticket.ticket_no} — ${ticket.title}`,
        url: '/tickets',
      });
    }

    res.status(201).json({ message: 'Balasan berhasil dikirim.', reply });
  } catch (error) { next(error); }
};

// 5. Mengambil daftar pengurus yang bisa ditugaskan, dikelompokkan per organisasi
export const getAssignees = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pengurus = await prisma.user.findMany({
      where: { role: { in: [...ADMIN_ROLES, ...OFFICER_ROLES] as any }, isActive: true },
      select: {
        id: true,
        nim: true,
        role: true,
        profile: { select: { nama: true, program_studi: true } },
      },
      orderBy: { role: 'asc' },
    });

    res.status(200).json({
      data: pengurus.map((p) => ({
        ...p,
        organisasi: ROLE_TARGET[p.role] ? TARGET_LABEL[ROLE_TARGET[p.role]] : 'BEM (Umum)',
      })),
    });
  } catch (error) { next(error); }
};

// 6. Delegasi Tiket
export const assignTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    const assignerId = req.user.id;

    if (!assigneeId) { res.status(400).json({ message: 'Pengurus wajib dipilih.' }); return; }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { assignments: { where: { isActive: true } } },
    });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    if (!canAccessTicket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak berhak menugaskan tiket ini.' });
      return;
    }

    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee) { res.status(404).json({ message: 'Pengurus tidak ditemukan.' }); return; }

    // Lima write harus lolos atau gagal bersama: tiket yang tercatat
    // ditugaskan tanpa baris penugasan aktif membuat pengurus berikutnya
    // melihat tiket yang tampak tanpa pemilik.
    const newAssignment = await prisma.$transaction(async (tx) => {
      await tx.ticketAssignment.updateMany({
        where: { ticketId: id, isActive: true },
        data: { isActive: false },
      });

      const penugasan = await tx.ticketAssignment.create({
        data: { ticketId: id, assigneeId, assignerId },
      });

      if (ticket.status === 'DIKIRIM') {
        await tx.ticket.update({ where: { id }, data: { status: 'DIPROSES' } });

        await tx.notification.create({
          data: {
            userId: ticket.senderId,
            title: 'Status Tiket Diperbarui',
            message: `Tiket #${ticket.ticket_no} Anda saat ini mulai diproses oleh pengurus.`,
          },
        });
      }

      // Beri tahu pengurus yang ditugaskan supaya tidak ada tiket yang menganggur.
      await tx.notification.create({
        data: {
          userId: assigneeId,
          title: 'Tiket Ditugaskan Kepada Anda',
          message: `Anda ditugaskan menangani tiket #${ticket.ticket_no} (${ticket.title}).`,
        },
      });

      return penugasan;
    });

    // Push di luar transaksi: efek samping jaringan tidak dibatalkan oleh rollback.
    await kirimPushKePengguna(assigneeId, {
      title: 'Tiket Ditugaskan Kepada Anda',
      body: `#${ticket.ticket_no} — ${ticket.title}`,
      url: '/tickets',
    });

    res.status(200).json({ message: 'Tiket berhasil ditugaskan.', data: newAssignment });
  } catch (error) { next(error); }
};

// 7. Mengubah status moderasi / status tiket
export const setTicketModeration = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Penjaga peran paling awal, sebelum body dibaca dan sebelum query: penulis
    // tiket (MAHASISWA) berhak membacanya, tidak berhak mengubah statusnya.
    if (!isAdminRole(req.user.role) && !isOfficer(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin atau pengurus yang dapat mengubah status tiket.' });
      return;
    }

    const { id } = req.params;
    const { moderationStatus, status } = req.body;

    const data: Record<string, unknown> = {};

    if (moderationStatus) {
      const boleh = ['PENDING_MODERATION', 'PUBLISHED', 'REJECTED'];
      if (!boleh.includes(moderationStatus)) {
        res.status(400).json({ message: 'Status moderasi tidak dikenali.' });
        return;
      }
      data.moderationStatus = moderationStatus;
      data.moderatedById = req.user.id;
      data.moderatedAt = new Date();
    }

    if (status) {
      const boleh = ['DIKIRIM', 'DITINJAU', 'DIPROSES', 'SELESAI', 'DITOLAK'];
      if (!boleh.includes(status)) {
        res.status(400).json({ message: 'Status tiket tidak dikenali.' });
        return;
      }
      data.status = status;
      // Waktu selesai dipakai laporan bulanan untuk menghitung durasi layanan.
      data.resolvedAt = status === 'SELESAI' || status === 'DITOLAK' ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ message: 'Tidak ada perubahan yang dikirim.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { assignments: { where: { isActive: true } } },
    });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    // Hak baca tidak cukup di sini: tanpa penugasan aktif, pengurus tidak boleh
    // mengubah status maupun menandatangani moderatedById atas tiket orang lain.
    if (!bolehMemoderasiTiket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak berhak mengubah tiket ini.' });
      return;
    }

    const { updated, beriTahuPemilik } = await prisma.$transaction(async (tx) => {
      const hasil = await tx.ticket.update({ where: { id }, data });

      if (!status || status === ticket.status || ticket.senderId === req.user.id) {
        return { updated: hasil, beriTahuPemilik: null as null | string };
      }

      const pesanStatus: Record<string, string> = {
        DIKIRIM: 'kembali menunggu tinjauan',
        DITINJAU: 'sedang ditinjau',
        DIPROSES: 'sedang diproses',
        SELESAI: 'telah selesai',
        DITOLAK: 'ditolak',
      };
      const pesan = pesanStatus[status] || 'diperbarui';

      await tx.notification.create({
        data: {
          userId: ticket.senderId,
          title: 'Status Tiket Diperbarui',
          message: `Tiket #${ticket.ticket_no} ${pesan} oleh pengurus.`,
        },
      });

      return { updated: hasil, beriTahuPemilik: pesan };
    });

    // Push di luar transaksi: efek samping jaringan tidak dibatalkan oleh rollback.
    if (beriTahuPemilik) {
      await kirimPushKePengguna(ticket.senderId, {
        title: 'Status Tiket Diperbarui',
        body: `#${ticket.ticket_no} ${beriTahuPemilik}.`,
        url: '/tickets',
      });
    }

    res.status(200).json({ message: 'Tiket berhasil diperbarui.', data: updated });
  } catch (error) { next(error); }
};

// 8. Melepas penugasan aktif tanpa menghapus tiket.
//    Hanya DPM, admin, dan superadmin; tiket harus berada dalam jangkauan
//    pembacanya supaya pengurus himpunan tidak bisa melepas tugas organisasi lain.
export const unassignTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehHapusTiket(req.user.role)) {
      res.status(403).json({
        message: 'Hanya pengurus DPM, admin, dan superadmin yang dapat melepas penugasan tiket.',
      });
      return;
    }

    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { assignments: { where: { isActive: true } } },
    });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    if (!canAccessTicket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak berhak melepas penugasan tiket ini.' });
      return;
    }

    if (ticket.assignments.length === 0) {
      res.status(400).json({ message: 'Tiket ini tidak memiliki penugasan aktif.' });
      return;
    }

    await prisma.ticketAssignment.updateMany({
      where: { ticketId: id, isActive: true },
      data: { isActive: false, completedAt: new Date() },
    });

    await logActivity(
      req.user.id,
      'UNASSIGN_TICKET',
      'Ticket',
      `Melepas penugasan tiket #${ticket.ticket_no}`,
      id
    );

    res.status(200).json({ message: 'Penugasan tiket berhasil dilepas.' });
  } catch (error) { next(error); }
};

// 9. Menghapus tiket beserta balasan, penugasan, dan lampirannya.
export const deleteTicket = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehHapusTiket(req.user.role)) {
      res.status(403).json({
        message: 'Hanya pengurus DPM, admin, dan superadmin yang dapat menghapus tiket.',
      });
      return;
    }

    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignments: { where: { isActive: true } },
        attachments: { select: { id: true, url: true } },
      },
    });
    if (!ticket) { res.status(404).json({ message: 'Tiket tidak ditemukan.' }); return; }

    if (!canAccessTicket(req.user, ticket)) {
      res.status(403).json({ message: 'Anda tidak berhak menghapus tiket ini.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Urutan penting: anak-anak tiket lebih dulu karena foreign key-nya
      // RESTRICT (tanpa onDelete Cascade).
      await tx.ticketReply.deleteMany({ where: { ticketId: id } });
      await tx.ticketAssignment.deleteMany({ where: { ticketId: id } });
      await tx.attachment.deleteMany({ where: { ticketId: id } });
      await tx.ticket.delete({ where: { id } });
    });

    // Berkas lampiran dihapus setelah transaksi sukses, dengan best effort:
    // kegagalan menghapus berkas tidak boleh membatalkan penghapusan data.
    await Promise.all(ticket.attachments.map((lampiran) => hapusLampiran(lampiran.url)));

    await logActivity(
      req.user.id,
      'DELETE_TICKET',
      'Ticket',
      `Menghapus tiket #${ticket.ticket_no} "${ticket.title}" beserta balasan dan lampirannya`,
      id
    );

    res.status(200).json({ message: `Tiket #${ticket.ticket_no} berhasil dihapus.` });
  } catch (error) { next(error); }
};

// 10. Ekspor data keluhan ke Excel (hanya ADMIN & PENGURUS DPM)
export const exportKeluhanExcel = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!canExportKeluhan(req.user.role)) {
      res.status(403).json({ message: 'Hanya PENGURUS DPM dan Admin yang dapat mengaudit data keluhan.' });
      return;
    }

    const daftar = await prisma.ticket.findMany({
      where: { type: 'KELUHAN' },
      include: {
        sender: { select: { nim: true, profile: { select: { nama: true, program_studi: true } } } },
        assignments: {
          where: { isActive: true },
          include: { assignee: { include: { profile: { select: { nama: true } } } } },
        },
        // Jumlah balasan diambil sebagai hitungan di DB, bukan barisnya: kolom
        // audit "Jumlah Balasan" butuh angka persis, jadi tidak boleh dibatasi take.
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BEM-FT UNAYA';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Audit Keluhan');

    sheet.columns = [
      { header: 'No. Tiket', key: 'ticket_no', width: 24 },
      { header: 'Tanggal Masuk', key: 'tanggal', width: 20 },
      { header: 'Organisasi Tujuan', key: 'target', width: 30 },
      { header: 'Kategori', key: 'category', width: 18 },
      { header: 'Judul', key: 'title', width: 34 },
      { header: 'Isi Keluhan', key: 'content', width: 60 },
      { header: 'NIM Pengirim', key: 'nim', width: 18 },
      { header: 'Nama Pengirim', key: 'nama', width: 28 },
      { header: 'Program Studi', key: 'prodi', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Moderasi', key: 'moderasi', width: 20 },
      { header: 'Ditangani Oleh', key: 'petugas', width: 26 },
      { header: 'Jumlah Balasan', key: 'balasan', width: 16 },
    ];

    daftar.forEach((t) => {
      sheet.addRow({
        ticket_no: t.ticket_no,
        tanggal: t.createdAt.toLocaleString('id-ID'),
        target: t.targetOrganization ? TARGET_LABEL[t.targetOrganization as TicketTarget] : '-',
        category: t.category,
        title: t.title,
        content: t.content,
        nim: t.sender.nim,
        nama: t.sender.profile?.nama ?? '-',
        prodi: t.sender.profile?.program_studi ?? '-',
        status: t.status,
        moderasi: t.moderationStatus,
        petugas: t.assignments[0]?.assignee.profile?.nama ?? '-',
        balasan: t._count.replies,
      });
    });

    // Baris judul di atas tabel supaya hasil audit langsung terbaca.
    sheet.insertRow(1, [`Audit Keluhan BEM-FT UNAYA - dicetak ${new Date().toLocaleString('id-ID')}`]);
    sheet.mergeCells(1, 1, 1, sheet.columnCount);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.getRow(1).alignment = { horizontal: 'center' };
    sheet.insertRow(2, []);
    // Baris header asli kini berada di baris 3.
    sheet.getRow(3).font = { bold: true };
    sheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFBBF24' },
    };

    const namaFile = `audit-keluhan-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};
