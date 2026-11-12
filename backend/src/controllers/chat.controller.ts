import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { kirimPushKePengguna } from '../services/push.service';
import { isAdminRole } from '../lib/ticket-access';
import { bacaKataTerlarang, simpanKataTerlarang, saringKata } from '../lib/forum-filter';

/**
 * Forum diskusi (ruang percakapan).
 *
 * Aturan akses:
 * - Membaca & menulis pesan: semua akun yang sudah login (tamu ditolak 401).
 * - Membuat ruang: pengurus BEM/DPM, tiga pengurus prodi, ADMIN, SUPERADMIN.
 * - Menutup & menghapus ruang, filter kata, moderasi pesan: tetap pengurus BEM,
 *   pengurus DPM, ADMIN, dan SUPERADMIN. Pengurus prodi boleh memulai ruang
 *   untuk organisasinya, tetapi tidak mengelola ruang milik pengurus lain.
 * - Ruang buatan pengurus prodi belum tayang sebelum pengelola forum
 *   menyetujuinya (POST /rooms/:id/approve); lihat ruangPerluPersetujuan.
 */
const ROLE_PENGELOLA_RUANG = ['PENGURUS_BEM', 'PENGURUS_DPM', 'ADMIN', 'SUPERADMIN'];

/** Tambahan hak membuat ruang saja; tidak ikut mengelola ruang. */
const ROLE_PEMBUAT_RUANG_PRODI = ['PENGURUS_SISTEM_INFORMASI', 'PENGURUS_TEKNIK_SIPIL', 'PENGURUS_TEKNIK_MESIN'];

const bolehKelolaRuang = (role: string | undefined): boolean =>
  !!role && (ROLE_PENGELOLA_RUANG.includes(role) || isAdminRole(role));

const bolehBuatRuang = (role: string | undefined): boolean =>
  bolehKelolaRuang(role) || (!!role && ROLE_PEMBUAT_RUANG_PRODI.includes(role));

/**
 * Ruang baru perlu persetujuan bila pembuatnya berhak membuat ruang tapi bukan
 * pengelola forum, yaitu tiga pengurus prodi (keputusan pemilik AUDIT-18 F3:
 * ruang prodi boleh dilihat lintas prodi, asal disetujui dulu). Diturunkan dari
 * role, tidak pernah dari isi permintaan.
 */
export const ruangPerluPersetujuan = (role: string | undefined): boolean =>
  bolehBuatRuang(role) && !bolehKelolaRuang(role);

/**
 * Ruang yang belum disetujui hanya boleh dibuka oleh pembuatnya sendiri atau
 * pengelola forum. Tanpa ini moderasi F3 bocor lewat id: ruang itu hilang dari
 * daftar, tetapi riwayatnya tetap terbaca dan bisa ditulisi oleh akun mana pun
 * yang tahu id-nya — dan id itu keluar di respons pembuatan ruang.
 */
export const ruangTertundaTerkunci = (
  ruang: { pendingApproval: boolean; createdById: string },
  penonton: { id: string; role?: string }
): boolean =>
  ruang.pendingApproval && ruang.createdById !== penonton.id && !bolehKelolaRuang(penonton.role);

/**
 * Forum baru "terbuka" bila ada minimal satu ruang yang dibuka pengurus.
 * Mahasiswa/umum tidak melihat menu maupun daftar ruang sebelum itu.
 * Ruang yang masih menunggu persetujuan tidak ikut menghitung, padahal
 * `isOpen`-nya true: ruang itu belum boleh membuka forum untuk akun lain.
 */
const adaRuangTerbuka = async (): Promise<boolean> => {
  const jumlah = await prisma.chatRoom.count({ where: { isOpen: true, pendingApproval: false } });
  return jumlah > 0;
};

/** GET /api/chat/filter — daftar kata yang disamarkan (pengelola forum). */
export const getForumFilter = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Hanya pengelola forum yang dapat melihat filter kata.' });
      return;
    }

    res.status(200).json({ data: await bacaKataTerlarang() });
  } catch (error) { next(error); }
};

/** PUT /api/chat/filter — mengganti daftar kata yang disamarkan. */
export const saveForumFilter = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Hanya pengelola forum yang dapat mengubah filter kata.' });
      return;
    }

    if (!Array.isArray(req.body?.kata)) {
      res.status(400).json({ message: 'Daftar kata wajib dikirim sebagai array (kosongkan untuk mematikan filter).' });
      return;
    }

    const kata = await simpanKataTerlarang(req.body.kata);

    await logActivity(
      req.user.id,
      'UPDATE_FORUM_FILTER',
      'SiteSetting',
      `Mengubah filter kata forum menjadi ${kata.length} kata`
    );

    res.status(200).json({
      message:
        kata.length === 0
          ? 'Filter kata dikosongkan; pesan forum ditampilkan apa adanya.'
          : `Filter kata disimpan (${kata.length} kata). Kata tersebut disamarkan pada pesan forum.`,
      data: kata,
    });
  } catch (error) { next(error); }
};

/** GET /api/chat/status — apakah forum sudah dibuka, plus hak kelola pengguna. */
export const getForumStatus = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      forumTerbuka: await adaRuangTerbuka(),
      bolehKelola: bolehKelolaRuang(req.user?.role),
      bolehMembuatRuang: bolehBuatRuang(req.user?.role),
    });
  } catch (error) { next(error); }
};

const ambilTeks = (nilai: unknown, maks: number): string =>
  String(nilai ?? '').trim().slice(0, maks);

const bentukPesan = (
  pesan: {
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
  },
  kata: string[]
) => ({
  id: pesan.id,
  content: saringKata(pesan.content, kata),
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
    const buat = bolehBuatRuang(req.user?.role);
    // Pengurus prodi boleh membuat ruang, jadi mereka melihat halaman ini juga
    // saat forum belum punya ruang sama sekali.
    const forumTerbuka = buat || (await adaRuangTerbuka());

    // Sebelum pengurus membuka ruang, forum tidak ditampilkan sama sekali
    // kepada mahasiswa: bukan hanya tombolnya yang disembunyikan, datanya juga.
    if (!forumTerbuka) {
      res.status(200).json({
        data: [],
        meta: { bolehMembuatRuang: false, forumTerbuka: false },
      });
      return;
    }

    const kata = await bacaKataTerlarang();
    // Ruang tertunda hanya terlihat oleh pengelola forum dan pembuatnya sendiri;
    // pengarang tetap perlu melihat ruangannya supaya tahu statusnya belum tayang.
    const kelola = bolehKelolaRuang(req.user?.role);
    const rooms = await prisma.chatRoom.findMany({
      where: kelola ? {} : { OR: [{ pendingApproval: false }, { createdById: req.user.id }] },
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
        pendingApproval: ruang.pendingApproval,
        jumlahPesan: ruang._count.messages,
        pesanTerakhir: ruang.messages[0]
          ? { isi: saringKata(ruang.messages[0].content, kata), pada: ruang.messages[0].createdAt }
          : null,
      })),
      meta: { bolehMembuatRuang: buat, forumTerbuka: true },
    });
  } catch (error) { next(error); }
};

/** POST /api/chat/rooms — membuat ruang baru (BEM, DPM, prodi, admin). */
export const createRoom = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehBuatRuang(req.user?.role)) {
      res.status(403).json({
        message: 'Hanya pengurus BEM, DPM, prodi, dan admin yang dapat membuat ruang forum.',
      });
      return;
    }

    const kata = await bacaKataTerlarang();
    const nama = saringKata(ambilTeks(req.body?.nama, 100), kata);
    const deskripsi = saringKata(ambilTeks(req.body?.deskripsi, 500), kata);

    if (nama.length < 3) {
      res.status(400).json({ message: 'Nama ruang minimal 3 karakter.' });
      return;
    }

    const baru = await prisma.chatRoom.create({
      data: {
        name: nama,
        description: deskripsi || null,
        createdById: req.user.id,
        pendingApproval: ruangPerluPersetujuan(req.user?.role),
      },
    });

    await logActivity(req.user.id, 'CREATE_CHAT_ROOM', 'ChatRoom', `Membuat ruang forum "${nama}"`, baru.id);

    res.status(201).json({
      message: baru.pendingApproval
        ? `Ruang "${nama}" dibuat dan menunggu persetujuan pengelola forum sebelum tampil ke semua akun.`
        : `Ruang "${nama}" berhasil dibuat.`,
      data: baru,
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/chat/rooms/:id/approve — menyetujui ruang tertunda.
 *
 * Sengaja rute tersendiri, bukan tambahan pada PATCH /rooms/:id: gerbang
 * buka/tutup ruang dan gerbang persetujuan memang sama-sama bolehKelolaRuang,
 * tapi maknanya berbeda, dan assert K1 menjaga bolehBuatRuang tidak ikut naik
 * ke jalur status.
 */
export const approveRoom = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!bolehKelolaRuang(req.user?.role)) {
      res.status(403).json({ message: 'Hanya pengurus BEM, DPM, dan admin yang dapat menyetujui ruang forum.' });
      return;
    }

    const id = String(req.params.id);
    const lama = await prisma.chatRoom.findUnique({
      where: { id },
      select: { id: true, name: true, pendingApproval: true, createdById: true },
    });
    if (!lama) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    if (!lama.pendingApproval) {
      res.status(200).json({ message: `Ruang "${lama.name}" sudah disetujui sebelumnya.` });
      return;
    }

    await prisma.chatRoom.update({ where: { id }, data: { pendingApproval: false } });

    await prisma.notification.create({
      data: {
        userId: lama.createdById,
        title: 'Ruang forum disetujui',
        message: `Ruang "${lama.name}" kini tampil untuk semua akun.`,
      },
    });
    await kirimPushKePengguna(lama.createdById, {
      title: 'Ruang forum disetujui',
      body: `Ruang "${lama.name}" kini tampil untuk semua akun.`,
      url: '/forum',
    });

    await logActivity(req.user.id, 'APPROVE_CHAT_ROOM', 'ChatRoom', `Menyetujui ruang forum "${lama.name}"`, id);

    res.status(200).json({ message: `Ruang "${lama.name}" disetujui dan kini tampil untuk semua akun.` });
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

/**
 * GET /api/chat/rooms/:id/messages — pesan sebuah ruang.
 *
 * Mendukung dua mode:
 * - Tanpa parameter: 200 pesan terbaru, berurutan dari lama ke baru (dipakai
 *   saat pertama membuka ruang dan saat sinkronisasi penuh berkala).
 * - `?after=<id pesan terakhir yang dilihat klien>`: hanya pesan dengan waktu
 *   muat >= pesan itu. Dipakai polling cepat agar obrolan terasa live tanpa
 *   mengunduh ulang seluruh riwayat tiap beberapa detik. Klien menyaring
 *   duplikatnya sendiri, sehingga pesan dengan stempel waktu sama tetap
 *   tertangkap dan tidak terlewat.
 */
export const getMessages = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const after = String(req.query.after || '').trim();

    const ruang = await prisma.chatRoom.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, isOpen: true, pendingApproval: true, createdById: true },
    });
    if (!ruang) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    // Ruang tertunda diperlakukan sama persis seperti ruang yang tidak ada:
    // pesan yang berbeda membuat id ruang tertunda bisa dicari dari luar.
    if (ruangTertundaTerkunci(ruang, { id: req.user.id, role: req.user?.role })) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }

    // Membaca riwayat ruang yang sudah ditutup tetap boleh selama forum punya
    // ruang terbuka lain. Bila semua ruang ditutup, mahasiswa tidak boleh
    // mengakses forum lewat URL langsung sekalipun.
    if (!ruang.isOpen && !bolehKelolaRuang(req.user?.role) && !(await adaRuangTerbuka())) {
      res.status(403).json({
        code: 'FORUM_BELUM_DIBUKA',
        message: 'Forum diskusi belum dibuka oleh pengurus.',
      });
      return;
    }

    // Ambil waktu pesan batas; bila id-nya sudah tidak ada (dihapus), abaikan
    // saja penyaringnya dan kirimkan daftar penuh sebagai penyelamatan.
    let filterWaktu: { createdAt?: { gte: Date } } = {};
    if (after) {
      const batas = await prisma.chatMessage.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      if (batas) filterWaktu = { createdAt: { gte: batas.createdAt } };
    }

    // Tanpa batas waktu berarti memuat riwayat penuh (muat awal atau
    // sinkronisasi berkala). Ambil 200 pesan TERBARU, bukan yang terlama:
    // ruang yang lebih panjang dari 200 pesan tidak boleh kembali menampilkan
    // percakapan lama setiap kali sinkronisasi penuh berjalan.
    const memuatPenuh = !filterWaktu.createdAt;

    const [pesan, kata] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { roomId: id, ...filterWaktu },
        orderBy: { createdAt: memuatPenuh ? 'desc' : 'asc' },
        take: 200,
        include: { author: { select: penulisSelect } },
      }),
      bacaKataTerlarang(),
    ]);

    // Kueri di atas menurun untuk memilih pesan terakhir; balik agar respons
    // tetap berurutan dari lama ke baru seperti yang diharapkan klien.
    if (memuatPenuh) pesan.reverse();

    res.status(200).json({
      data: pesan.map((p) => bentukPesan(p, kata)),
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
    const isiAsli = ambilTeks(req.body?.isi, 2000);

    if (!isiAsli) {
      res.status(400).json({ message: 'Pesan tidak boleh kosong.' });
      return;
    }

    const kata = await bacaKataTerlarang();
    const isi = saringKata(isiAsli, kata);
    const disaring = isi !== isiAsli;

    const ruang = await prisma.chatRoom.findUnique({
      where: { id },
      select: { id: true, isOpen: true, pendingApproval: true, createdById: true },
    });
    if (!ruang) {
      res.status(404).json({ message: 'Ruang forum tidak ditemukan.' });
      return;
    }
    if (ruangTertundaTerkunci(ruang, { id: req.user.id, role: req.user?.role })) {
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

    res.status(201).json({
      message: disaring
        ? 'Pesan terkirim. Beberapa kata disamarkan sesuai filter forum.'
        : 'Pesan terkirim.',
      data: bentukPesan(baru, kata),
    });
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
