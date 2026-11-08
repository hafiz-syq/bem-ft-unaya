import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole, isOfficer } from '../lib/ticket-access';
import { hitungAngkatan } from '../services/account-lifecycle.service';
import { kirimPushKeBanyak } from '../services/push.service';

type Audience = 'SEMUA' | 'ROLE' | 'ANGKATAN' | 'ORGANISASI';

const AUDIENCES: Audience[] = ['SEMUA', 'ROLE', 'ANGKATAN', 'ORGANISASI'];
const ROLE_VALID = [
  'MAHASISWA',
  'PENGURUS',
  'PENGURUS_DPM',
  'PENGURUS_BEM',
  'PENGURUS_SISTEM_INFORMASI',
  'PENGURUS_TEKNIK_MESIN',
  'PENGURUS_TEKNIK_SIPIL',
  'ADMIN',
];

/**
 * Gerbang kasar tulis pengumuman: admin dan seluruh pengurus (termasuk pengurus
 * prodi). Ruang kelola daftar penuh (/manage) tetap hanya admin, dan ubah/hapus
 * dibatasi lagi terhadap pengumuman buatan sendiri.
 */
const bolehTulisPengumuman = (role: string): boolean => isAdminRole(role) || isOfficer(role);

/**
 * Cakupan siaran, terpisah dari hak menulis. SEMUA/ROLE/ANGKATAN menjangkau
 * seluruh akun aktif (notifikasi + web push), jadi khusus admin; pengurus
 * hanya boleh mengirim ke organisasinya sendiri.
 */
export const cakupanButuhAdmin = (audience: string): boolean => audience !== 'ORGANISASI';

/**
 * Menyusun filter penerima pengumuman. Aturan ini dipakai saat membuat
 * pengumuman (notifikasi) dan saat membaca daftar, sehingga penerima yang
 * disebut di notifikasi selalu sama dengan yang melihat di halaman.
 */
export function filterPenerima(announcement: {
  audience: string;
  audienceRole: string | null;
  audienceAngkatan: number | null;
  audienceOrganizationId: string | null;
}): Record<string, unknown> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };

  if (announcement.audience === 'ROLE' && announcement.audienceRole) {
    where.role = announcement.audienceRole;
  }

  if (announcement.audience === 'ANGKATAN' && announcement.audienceAngkatan) {
    const duaDigit = String(announcement.audienceAngkatan).slice(-2);
    where.nim = { startsWith: duaDigit };
  }

  if (announcement.audience === 'ORGANISASI' && announcement.audienceOrganizationId) {
    where.positions = {
      some: {
        isActive: true,
        positionSlot: { organizationId: announcement.audienceOrganizationId },
      },
    };
  }

  return where;
}

const cocokUntukPengguna = (
  announcement: {
    audience: string;
    audienceRole: string | null;
    audienceAngkatan: number | null;
    audienceOrganizationId: string | null;
  },
  user: { role: string; nim: string; positions: { organizationId: string }[] }
): boolean => {
  if (announcement.audience === 'ROLE') return announcement.audienceRole === user.role;
  if (announcement.audience === 'ANGKATAN') return hitungAngkatan(user.nim) === announcement.audienceAngkatan;
  if (announcement.audience === 'ORGANISASI') {
    return user.positions.some((p) => p.organizationId === announcement.audienceOrganizationId);
  }
  return true;
};

/**
 * Pengumuman terbaca oleh penerimanya bila terbit dan khalayaknya cocok, dan
 * selalu terbaca oleh pembuatnya sendiri — termasuk draf dan khalayak yang
 * tidak mencakup akun penulis — karena hak ubah/hapus hanya bisa dipakai dari
 * daftar ini.
 */
export const layakDitampilkan = (
  announcement: {
    isPublished: boolean;
    createdById: string | null;
    audience: string;
    audienceRole: string | null;
    audienceAngkatan: number | null;
    audienceOrganizationId: string | null;
  },
  user: { id: string; role: string; nim: string; positions: { organizationId: string }[] }
): boolean =>
  announcement.createdById === user.id ||
  (announcement.isPublished && cocokUntukPengguna(announcement, user));
/** Daftar pengumuman yang relevan untuk pengguna yang sedang login. */
export const getAnnouncements = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pengguna = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        role: true,
        nim: true,
        positions: {
          where: { isActive: true },
          select: { positionSlot: { select: { organizationId: true } } },
        },
      },
    });

    const daftar = await prisma.announcement.findMany({
      where: { OR: [{ isPublished: true }, { createdById: req.user.id }] },
      orderBy: { createdAt: 'desc' },
      // shortcut: plafon 60 berlaku gabungan terbit + punya sendiri; naikkan
      // level bila pengurus mulai kehilangan item lamanya di sini.
      take: 60,
      include: {
        reads: { where: { userId: req.user.id }, select: { id: true } },
        _count: { select: { reads: true } },
        createdBy: { select: { profile: { select: { nama: true } }, nim: true } },
      },
    });

    const data = daftar
      .filter((a) =>
        pengguna
          ? layakDitampilkan(a, {
              id: req.user.id,
              role: pengguna.role,
              nim: pengguna.nim,
              positions: pengguna.positions.map((p) => ({ organizationId: p.positionSlot.organizationId })),
            })
          : false
      )
      .map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        audience: a.audience,
        audienceRole: a.audienceRole,
        audienceAngkatan: a.audienceAngkatan,
        audienceOrganizationId: a.audienceOrganizationId,
        isPublished: a.isPublished,
        createdAt: a.createdAt,
        penulis: a.createdBy.profile?.nama || a.createdBy.nim,
        // Pengurus butuh penanda ini untuk tahu mana yang boleh ia ubah/hapus;
        // halaman pembaca biasa tidak memakai.
        punyaSaya: a.createdById === req.user.id,
        dibaca: a.reads.length > 0,
        jumlahPembaca: a._count.reads,
      }));

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const getManagedAnnouncements = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin yang dapat mengelola pengumuman.' });
      return;
    }

    const data = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { reads: true } },
        createdBy: { select: { nim: true, profile: { select: { nama: true } } } },
      },
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehTulisPengumuman(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin dan pengurus yang dapat membuat pengumuman.' });
      return;
    }
    const penulisAdmin = isAdminRole(req.user.role);

    const title = String(req.body?.title || '').trim().slice(0, 180);
    const content = String(req.body?.content || '').trim().slice(0, 10000);
    const audience = String(req.body?.audience || 'SEMUA').toUpperCase() as Audience;
    const audienceRole = req.body?.audienceRole ? String(req.body.audienceRole).toUpperCase() : null;
    const audienceAngkatan = req.body?.audienceAngkatan ? Number(req.body.audienceAngkatan) : null;
    const audienceOrganizationId = req.body?.audienceOrganizationId
      ? String(req.body.audienceOrganizationId)
      : null;
    // Draf khusus admin: draf pengurus tidak punya tempat di daftar pembaca,
    // jadi item tak terbit hanya akan menggantung tak bisa ditemukan.
    const isPublished = penulisAdmin ? req.body?.isPublished !== false : true;

    if (!title || !content) {
      res.status(400).json({ message: 'Judul dan isi pengumuman wajib diisi.' });
      return;
    }
    if (!AUDIENCES.includes(audience)) {
      res.status(400).json({ message: 'Segmen pengumuman tidak dikenali.' });
      return;
    }
    if (audience === 'ROLE' && (!audienceRole || !ROLE_VALID.includes(audienceRole))) {
      res.status(400).json({ message: 'Pilih role penerima yang valid.' });
      return;
    }
    if (
      audience === 'ANGKATAN' &&
      (!Number.isInteger(audienceAngkatan) || (audienceAngkatan as number) < 2000 || (audienceAngkatan as number) > 2099)
    ) {
      res.status(400).json({ message: 'Tahun angkatan harus antara 2000 dan 2099.' });
      return;
    }
    // Cakupan siaran penulis non-admin. Nilai organisasi dari body tidak pernah
    // dipercaya apa adanya: /organizations hanya terbaca admin, jadi cakupan
    // pengurus diturunkan dari jabatan aktifnya sendiri.
    let idOrganisasi = audienceOrganizationId;
    if (!penulisAdmin && cakupanButuhAdmin(audience)) {
      res.status(403).json({
        message: 'Siaran ke seluruh akun (SEMUA/ROLE/ANGKATAN) khusus admin. Pengurus mengirim ke organisasinya sendiri.',
      });
      return;
    }
    if (!penulisAdmin && audience === 'ORGANISASI') {
      const akun = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { positions: { where: { isActive: true }, select: { positionSlot: { select: { organizationId: true } } } } },
      });
      const idMilikPenulis = (akun?.positions ?? []).map((p) => p.positionSlot.organizationId).sort();
      if (idMilikPenulis.length === 0) {
        res.status(403).json({ message: 'Akun Anda tidak punya jabatan aktif, jadi tidak ada organisasi yang bisa disiari.' });
        return;
      }
      if (idOrganisasi && !idMilikPenulis.includes(idOrganisasi)) {
        res.status(403).json({ message: 'Pengumuman hanya bisa dikirim ke organisasi tempat Anda aktif berjaga.' });
        return;
      }
      // shortcut: penulis multi-jabatan memakai organisasi pertamanya (id ikut
      // dikirim di respons); naikkan level bila pengurus memang perlu memilih.
      if (!idOrganisasi) idOrganisasi = idMilikPenulis[0];
    }
    if (audience === 'ORGANISASI' && !idOrganisasi) {
      res.status(400).json({ message: 'Pilih organisasi penerima.' });
      return;
    }

    // Pengumuman dan kotak masuk penerima ditulis bersama: gagal di tengah
    // meninggalkan pengumuman yang tampil tanpa notifikasi bagi sebagian akun.
    const { data, idPenerima } = await prisma.$transaction(async (tx) => {
      const baru = await tx.announcement.create({
        data: {
          title,
          content,
          audience,
          audienceRole: (audience === 'ROLE' ? audienceRole : null) as any,
          audienceAngkatan: audience === 'ANGKATAN' ? audienceAngkatan : null,
          audienceOrganizationId: audience === 'ORGANISASI' ? idOrganisasi : null,
          isPublished,
          createdById: req.user.id,
        },
      });

      if (!isPublished) return { data: baru, idPenerima: [] as string[] };

      const penerima = await tx.user.findMany({
        where: filterPenerima(baru) as any,
        select: { id: true },
      });

      if (penerima.length > 0) {
        await tx.notification.createMany({
          data: penerima.map((p) => ({
            userId: p.id,
            title: 'Pengumuman Baru',
            message: title,
          })),
        });
      }

      return { data: baru, idPenerima: penerima.map((p) => p.id) };
    });

    const jumlahPenerima = idPenerima.length;

    // Push di luar transaksi: efek samping jaringan tidak dibatalkan oleh rollback.
    if (jumlahPenerima > 0) {
      await kirimPushKeBanyak(idPenerima, {
        title: 'Pengumuman Baru',
        body: title,
        url: '/pengumuman',
      });
    }

    await logActivity(
      req.user.id,
      'CREATE_ANNOUNCEMENT',
      'Announcement',
      `Membuat pengumuman "${title}" untuk segmen ${audience} (${jumlahPenerima} penerima)`,
      data.id
    );

    res.status(201).json({
      message: `Pengumuman dibuat${isPublished ? ` dan dikirim ke ${jumlahPenerima} akun` : ' sebagai draf'}.`,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncement = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehTulisPengumuman(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin dan pengurus yang dapat mengubah pengumuman.' });
      return;
    }
    const lama = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!lama) {
      res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
      return;
    }
    if (!isAdminRole(req.user.role) && lama.createdById !== req.user.id) {
      res.status(403).json({ message: 'Hanya admin atau pembuat yang dapat mengubah pengumuman.' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 180) : lama.title;
    const content = req.body?.content !== undefined ? String(req.body.content).trim().slice(0, 10000) : lama.content;
    const isPublished = req.body?.isPublished !== undefined ? Boolean(req.body.isPublished) : lama.isPublished;

    if (!title || !content) {
      res.status(400).json({ message: 'Judul dan isi pengumuman tidak boleh kosong.' });
      return;
    }

    const data = await prisma.announcement.update({
      where: { id: lama.id },
      data: { title, content, isPublished },
    });

    res.status(200).json({ message: 'Pengumuman diperbarui.', data });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehTulisPengumuman(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin dan pengurus yang dapat menghapus pengumuman.' });
      return;
    }
    const lama = await prisma.announcement.findUnique({
      where: { id: req.params.id },
      select: { title: true, createdById: true },
    });
    if (!lama) {
      res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
      return;
    }
    if (!isAdminRole(req.user.role) && lama.createdById !== req.user.id) {
      res.status(403).json({ message: 'Hanya admin atau pembuat yang dapat menghapus pengumuman.' });
      return;
    }

    await prisma.announcement.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'DELETE_ANNOUNCEMENT', 'Announcement', `Menghapus pengumuman "${lama.title}"`, req.params.id);
    res.status(200).json({ message: 'Pengumuman dihapus.' });
  } catch (error) {
    next(error);
  }
};

export const markAnnouncementRead = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!announcement) {
      res.status(404).json({ message: 'Pengumuman tidak ditemukan.' });
      return;
    }

    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: announcement.id, userId: req.user.id } },
      update: {},
      create: { announcementId: announcement.id, userId: req.user.id },
    });

    res.status(200).json({ message: 'Pengumuman ditandai sudah dibaca.' });
  } catch (error) {
    next(error);
  }
};
