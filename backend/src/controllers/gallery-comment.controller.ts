import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';

/**
 * Komentar pada halaman Galeri.
 *
 * Aturan:
 * - Semua pengunjung boleh berkomentar, termasuk tamu tanpa akun. Pengguna yang
 *   login memakai nama dari profilnya; tamu wajib mengisi nama sendiri.
 * - Komentar baru berstatus PENDING dan baru tampil setelah disetujui
 *   admin/pengurus (sama seperti buku tamu).
 * - Komentar yang sudah tayang bisa dibaca siapa pun tanpa login.
 */

const BATAS_PANJANG = 2000;
const BATAS_NAMA = 60;
const BATAS_KOMENTAR_PER_10_MENIT = 10;
const BATAS_KOMENTAR_TAMU_PER_10_MENIT = 5;

/**
 * Pembatas komentar tamu per alamat IP.
 * Disimpan di memori proses: cukup untuk menahan banjir komentar dari satu
 * pengunjung, dan entri lama dibuang agar map tidak tumbuh tanpa batas.
 */
const riwayatKomentarTamu = new Map<string, number[]>();

const bolehKomentarTamu = (ip: string): boolean => {
  const sekarang = Date.now();
  const batasWaktu = sekarang - 10 * 60 * 1000;
  const riwayat = (riwayatKomentarTamu.get(ip) ?? []).filter((waktu) => waktu > batasWaktu);

  if (riwayat.length >= BATAS_KOMENTAR_TAMU_PER_10_MENIT) {
    riwayatKomentarTamu.set(ip, riwayat);
    return false;
  }

  riwayat.push(sekarang);
  riwayatKomentarTamu.set(ip, riwayat);

  if (riwayatKomentarTamu.size > 5000) {
    for (const [kunci, daftar] of riwayatKomentarTamu) {
      if (!daftar.some((waktu) => waktu > batasWaktu)) riwayatKomentarTamu.delete(kunci);
    }
  }

  return true;
};

type Permintaan = any;

const namaPenulis = (user: {
  nim: string;
  role: string;
  profile: { nama: string | null } | null;
}): string => user.profile?.nama || (isAdminRole(user.role) ? 'Administrator' : user.nim);

const bentukKomentar = (komentar: any) => ({
  id: komentar.id,
  content: komentar.content,
  status: komentar.status,
  createdAt: komentar.createdAt,
  // Komentar tamu tidak punya baris User; namanya diambil dari kolom guestName.
  penulis: komentar.author ? namaPenulis(komentar.author) : (komentar.guestName || 'Pengunjung'),
  role: komentar.author?.role ?? 'TAMU',
  foto: komentar.author ? (komentar.author.foto ?? komentar.author.profile?.foto ?? null) : null,
});

const selectPenulis = {
  nim: true,
  role: true,
  foto: true,
  profile: { select: { nama: true, foto: true } },
} as const;

/** GET /api/cms/galleries/:id/comments — komentar yang sudah disetujui (publik). */
export const getKomentarGaleri = async (req: Permintaan, res: Response, next: NextFunction): Promise<void> => {
  try {
    const galleryId = String(req.params.id);

    const gallery = await prisma.gallery.findUnique({ where: { id: galleryId }, select: { id: true } });
    if (!gallery) {
      res.status(404).json({ message: 'Galeri tidak ditemukan.' });
      return;
    }

    const komentar = await prisma.galleryComment.findMany({
      where: { galleryId, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      take: 300,
      include: { author: { select: selectPenulis } },
    });

    res.status(200).json({ data: komentar.map(bentukKomentar) });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cms/galleries/:id/comments — kirim komentar (publik).
 * Tamu wajib mengisi nama; pengguna login otomatis memakai identitas akunnya.
 */
export const kirimKomentarGaleri = async (req: Permintaan, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId: string | null = req.user?.id ?? null;
    const galleryId = String(req.params.id);
    const content = String(req.body?.content ?? '').trim();
    const namaTamu = String(req.body?.nama ?? '').replace(/\s+/g, ' ').trim();

    if (!content) {
      res.status(400).json({ message: 'Isi komentar tidak boleh kosong.' });
      return;
    }

    if (content.length > BATAS_PANJANG) {
      res.status(400).json({ message: `Komentar maksimal ${BATAS_PANJANG} karakter.` });
      return;
    }

    if (!userId) {
      if (namaTamu.length < 2) {
        res.status(400).json({ message: 'Nama wajib diisi minimal 2 karakter.' });
        return;
      }

      if (namaTamu.length > BATAS_NAMA) {
        res.status(400).json({ message: `Nama maksimal ${BATAS_NAMA} karakter.` });
        return;
      }
    }

    const gallery = await prisma.gallery.findUnique({ where: { id: galleryId }, select: { id: true, title: true } });
    if (!gallery) {
      res.status(404).json({ message: 'Galeri tidak ditemukan.' });
      return;
    }

    // Pembatas sederhana: cegah satu akun/tamu membanjiri antrean moderasi.
    if (userId) {
      const sepuluhMenitLalu = new Date(Date.now() - 10 * 60 * 1000);
      const jumlahBaru = await prisma.galleryComment.count({
        where: { authorId: userId, createdAt: { gte: sepuluhMenitLalu } },
      });
      if (jumlahBaru >= BATAS_KOMENTAR_PER_10_MENIT) {
        res.status(429).json({ message: 'Terlalu banyak komentar dalam waktu singkat. Coba lagi nanti.' });
        return;
      }
    } else if (!bolehKomentarTamu(String(req.ip ?? 'tanpa-ip'))) {
      res.status(429).json({ message: 'Terlalu banyak komentar dalam waktu singkat. Coba lagi nanti.' });
      return;
    }

    const baru = await prisma.galleryComment.create({
      data: {
        galleryId,
        authorId: userId,
        guestName: userId ? null : namaTamu,
        content,
      },
      include: { author: { select: selectPenulis } },
    });

    if (userId) {
      await logActivity(
        userId,
        'CREATE_GALLERY_COMMENT',
        'Gallery',
        `Mengomentari galeri "${gallery.title}"`,
        galleryId
      );
    }

    res.status(201).json({
      message: 'Komentar terkirim dan akan tampil setelah ditinjau admin/pengurus.',
      data: bentukKomentar(baru),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/cms/gallery-comments — antrean moderasi (admin/pengurus). */
export const getKomentarGaleriUntukModerasi = async (
  req: Permintaan,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = String(req.query?.status ?? 'ALL').toUpperCase();
    const where: Record<string, unknown> = {};
    if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;

    const [komentar, total, menunggu, disetujui, ditolak] = await Promise.all([
      prisma.galleryComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 300,
        include: {
          author: { select: selectPenulis },
          gallery: { select: { id: true, title: true, url: true } },
        },
      }),
      prisma.galleryComment.count(),
      prisma.galleryComment.count({ where: { status: 'PENDING' } }),
      prisma.galleryComment.count({ where: { status: 'APPROVED' } }),
      prisma.galleryComment.count({ where: { status: 'REJECTED' } }),
    ]);

    res.status(200).json({
      data: komentar.map((k) => ({
        ...bentukKomentar(k),
        galeri: { id: k.gallery.id, title: k.gallery.title, url: k.gallery.url },
      })),
      meta: { total, menunggu, disetujui, ditolak },
    });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/cms/gallery-comments/:id/status — setujui / tolak komentar. */
export const ubahStatusKomentarGaleri = async (
  req: Permintaan,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const status = String(req.body?.status ?? '').toUpperCase();

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Status tidak valid.' });
      return;
    }

    const lama = await prisma.galleryComment.findUnique({ where: { id } });
    if (!lama) {
      res.status(404).json({ message: 'Komentar tidak ditemukan.' });
      return;
    }

    const updated = await prisma.galleryComment.update({
      where: { id },
      data: { status: status as any, moderatedById: req.user.id, moderatedAt: new Date() },
    });

    await logActivity(
      req.user.id,
      'UPDATE_GALLERY_COMMENT_STATUS',
      'GalleryComment',
      `Mengubah status komentar galeri dari ${lama.status} menjadi ${status}`,
      id
    );

    res.status(200).json({ message: 'Status komentar diperbarui.', data: { id: updated.id, status: updated.status } });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/cms/gallery-comments/:id — hapus komentar dari antrean. */
export const hapusKomentarGaleri = async (
  req: Permintaan,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);

    const lama = await prisma.galleryComment.findUnique({ where: { id } });
    if (!lama) {
      res.status(404).json({ message: 'Komentar tidak ditemukan.' });
      return;
    }

    await prisma.galleryComment.delete({ where: { id } });

    await logActivity(
      req.user.id,
      'DELETE_GALLERY_COMMENT',
      'GalleryComment',
      `Menghapus komentar galeri: "${lama.content.slice(0, 80)}${lama.content.length > 80 ? '...' : ''}"`,
      id
    );

    res.status(200).json({ message: 'Komentar dihapus.' });
  } catch (error) {
    next(error);
  }
};
