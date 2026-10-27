import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';

/**
 * Forum diskusi (ruang percakapan).
 *
 * Aturan akses:
 * - Membaca & menulis pesan: semua akun yang sudah login (tamu ditolak 401).
 * - Membuat, menutup, dan menghapus ruang: pengurus BEM, pengurus DPM, ADMIN,
 *   dan SUPERADMIN. Dengan begitu forum tidak bisa dibanjiri ruang oleh akun
 *   biasa, tetapi mahasiswa tetap bebas berdiskusi di ruang yang sudah ada.
 */
const ROLE_PEMBUAT_RUANG = ['PENGURUS_BEM', 'PENGURUS_DPM', 'ADMIN', 'SUPERADMIN'];

const bolehKelolaRuang = (role: string | undefined): boolean =>
  !!role && (ROLE_PEMBUAT_RUANG.includes(role) || isAdminRole(role));

const ambilTeks = (nilai: unknown, maks: number): string =>
  String(nilai ?? '').trim().slice(0, maks);

const bentukPesan = (pesan: {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    nim: string;
    role: string;
    foto: string | null;
    profile: { nama: string } | null;
  };
}) => ({
  id: pesan.id,
  content: pesan.content,
  createdAt: pesan.createdAt,
  penulis: {
    id: pesan.author.id,
    nim: pesan.author.nim,
    role: pesan.author.role,
    nama: pesan.author.profile?.nama ?? pesan.author.nim,
    foto: pesan.author.foto ?? null,
  },
});

const penulisSelect = {
  id: true,
  nim: true,
  role: true,
  foto: true,
  profile: { select: { nama: true } },
} as const;

/** GET /api/chat/rooms — daftar ruang beserta jumlah pesan & aktivitas terakhir. */
export const getRooms = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      orderBy: [{ isOpen: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true },
        },
      },
    });

    res.status(200).json({
      data: rooms.map((ruang) => ({
        id: ruang.id,
        nama: ruang.name,
        deskripsi: ruang.description,
        isOpen: ruang.isOpen,
        jumlahPesan: ruang._count.messages,
        pesanTerakhir: ruang.messages[0]
          ? { isi: ruang.messages[0].content, pada: ruang.messages[0].createdAt }
          : null,
      })),
      meta: { bolehMembuatRuang: bolehKelolaRuang(req.user?.role) },
    });
  } catch (error) { next(error); }
};

/** POST /api/chat/rooms — membuat ruang baru (BEM, DPM, admin). */
export const createRoom = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({
        message: 'Hanya pengurus BEM, DPM, dan admin yang dapat membuat ruang forum.',
      });
      return;
    }

    const nama = ambilTeks(req.body?.nama, 100);
    const deskripsi = ambilTeks(req.body?.deskripsi, 500);

    if (nama.length < 3) {
      res.status(400).json({ message: 'Nama ruang minimal 3 karakter.' });
      return;
    }

    const baru = await prisma.chatRoom.create({
      data: {
        name: nama,
        description: deskripsi || null,
        createdById: req.user.id,
      },
    });

    await logActivity(req.user.id, 'CREATE_CHAT_ROOM', 'ChatRoom', `Membuat ruang forum "${nama}"`, baru.id);

    res.status(201).json({ message: `Ruang "${nama}" berhasil dibuat.`, data: baru });
  } catch (error) { next(error); }
};

/** PATCH /api/chat/rooms/:id — menutup atau membuka kembali ruang. */
export const setRoomStatus = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Hanya pengurus BEM, DPM, dan admin yang dapat mengubah status ruang.' });
      return;
    }

    const id = String(req.params.id);
    const isOpen = req.body?.isOpen === true || req.body?.isOpen === 'true';

    const lama = await prisma.chatRoom.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!lama) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    const updated = await prisma.chatRoom.update({ where: { id }, data: { isOpen } });

    await logActivity(
      req.user.id,
      isOpen ? 'OPEN_CHAT_ROOM' : 'CLOSE_CHAT_ROOM',
      'ChatRoom',
      `${isOpen ? 'Membuka' : 'Menutup'} ruang forum "${lama.name}"`,
      id
    );

    res.status(200).json({
      message: `Ruang "${lama.name}" ${isOpen ? 'dibuka kembali' : 'ditutup'}.`,
      data: updated,
    });
  } catch (error) { next(error); }
};

/** DELETE /api/chat/rooms/:id — menghapus ruang beserta seluruh pesannya. */
export const deleteRoom = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Hanya pengurus BEM, DPM, dan admin yang dapat menghapus ruang.' });
      return;
    }

    const id = String(req.params.id);
    const lama = await prisma.chatRoom.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!lama) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    // Pesan ikut terhapus lewat onDelete: Cascade.
    await prisma.chatRoom.delete({ where: { id } });

    await logActivity(req.user.id, 'DELETE_CHAT_ROOM', 'ChatRoom', `Menghapus ruang forum "${lama.name}"`, id);

    res.status(200).json({ message: `Ruang "${lama.name}" dihapus.` });
  } catch (error) { next(error); }
};

/** GET /api/chat/rooms/:id/messages — pesan sebuah ruang (polling setiap beberapa detik). */
export const getMessages = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);

    const ruang = await prisma.chatRoom.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, isOpen: true },
    });
    if (!ruang) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    const pesan = await prisma.chatMessage.findMany({
      where: { roomId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { author: { select: penulisSelect } },
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      data: pesan.map(bentukPesan),
      ruang: {
        id: ruang.id,
        nama: ruang.name,
        deskripsi: ruang.description,
        isOpen: ruang.isOpen,
        bolehKelola: bolehKelolaRuang(req.user?.role),
      },
    });
  } catch (error) { next(error); }
};

/** POST /api/chat/rooms/:id/messages — mengirim pesan ke ruang yang masih dibuka. */
export const sendMessage = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const isi = ambilTeks(req.body?.isi, 2000);

    if (!isi) {
      res.status(400).json({ message: 'Pesan tidak boleh kosong.' });
      return;
    }

    const ruang = await prisma.chatRoom.findUnique({ where: { id }, select: { id: true, isOpen: true } });
    if (!ruang) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }
    if (!ruang.isOpen) {
      res.status(403).json({ message: 'Ruang forum ini sudah ditutup oleh pengelola.' });
      return;
    }

    const baru = await prisma.chatMessage.create({
      data: { roomId: id, authorId: req.user.id, content: isi },
      include: { author: { select: penulisSelect } },
    });

    res.status(201).json({ message: 'Pesan terkirim.', data: bentukPesan(baru) });
  } catch (error) { next(error); }
};

/** DELETE /api/chat/messages/:id — hapus pesan (penulis sendiri atau pengelola ruang). */
export const deleteMessage = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);

    const lama = await prisma.chatMessage.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!lama) {
      res.status(404).json({ message: 'Pesan tidak ditemukan.' });
      return;
    }

    const milikSendiri = lama.authorId === req.user.id;
    if (!milikSendiri && !bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Anda hanya dapat menghapus pesan sendiri.' });
      return;
    }

    await prisma.chatMessage.delete({ where: { id } });

    res.status(200).json({ message: 'Pesan dihapus.' });
  } catch (error) { next(error); }
};
