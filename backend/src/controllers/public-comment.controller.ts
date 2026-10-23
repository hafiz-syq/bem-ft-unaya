import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';

/**
 * Permintaan dari pengguna yang sudah melewati `requireAuth`.
 *
 * Dua hal yang diperjelas di sini:
 * - Express 5 masih mengetikkan nilai `req.params` sebagai `string | string[]`,
 *   padahal rute di berkas ini selalu memakai satu nilai. Tanpa diperjelas,
 *   id komentar/balasan ikut terbaca `string | string[]` dan pemeriksaan tipe
 *   Prisma gagal (query dianggap tidak cocok sehingga hasilnya kehilangan
 *   relasi seperti `replies` dan `author`).
 * - `req.user` diisi middleware `requireAuth`, jadi harus dikenali TypeScript.
 */
type Permintaan = Request<Record<string, string>, unknown, unknown, Record<string, string | undefined>> & {
  user?: { id: string; role: string };
};

const ALLOWED_ROLES_FOR_MODERATION = ['ADMIN', 'SUPERADMIN', 'PENGURUS_BEM', 'PENGURUS_DPM', 'PENGURUS_SI', 'PENGURUS_TM', 'PENGURUS_TS'];

export const validateReplyContent = z.object({
  content: z.string().min(1).max(5000),
});

export const validateReplyPatch = z.object({
  content: z.string().min(1).max(5000).optional(),
  authorId: z.string().uuid().optional(),
});

// ─── Helper to check if user is allowed to moderate ───────────────────────
function canModerateComment(req: Permintaan, res: Response): boolean {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ message: 'Harus login untuk membalas atau memoderasi komentar.' });
    return false;
  }
  if (!ALLOWED_ROLES_FOR_MODERATION.includes(user.role)) {
    res.status(403).json({ message: 'Hanya admin dan pengurus yang dapat membalas atau memoderasi komentar.' });
    return false;
  }
  return true;
}

// ─── CRUD balasan khusus untuk admin/pengurus ──────────────────────────────
// GET /api/public-comments/:commentId/replies
// Ambil daftar balasan sebuah komentar (khusus admin/pengurus)
export const getRepliesForComment = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { commentId } = req.params;

    const comment = await prisma.publicComment.findUnique({
      where: { id: commentId },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });

    if (!comment) {
      res.status(404).json({ message: 'Komentar tidak ditemukan.' });
      return;
    }

    res.json({ data: comment.replies });
  } catch (error) {
    next(error);
  }
};

// POST /api/public-comments/:commentId/replies
// Tambah balasan baru
export const balasKomentar = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { commentId } = req.params;
    const { content } = req.body as { content: string };

    // Handler ini terdaftar di dua rute: /manage/:id/replies (param `id`)
    // dan /:commentId/replies (param `commentId`). Keduanya dibaca supaya
    // balasan dari halaman moderasi buku tamu tidak jatuh ke id undefined
    // (dulu: Prisma menolak create karena commentId kosong → 500).
    const idKomentar = req.params.commentId ?? req.params.id ?? commentId;
    if (!idKomentar) {
      res.status(400).json({ message: 'Id komentar tidak ada dalam permintaan.' });
      return;
    }

    const parsed = validateReplyContent.safeParse({ content });
    if (!parsed.success) {
      res.status(400).json({ message: (parsed.error as any).issues?.[0]?.message || (parsed.error as any).errors?.[0]?.message || 'Data tidak valid.' });
      return;
    }

    const newReply = await prisma.publicCommentReply.create({
      data: {
        commentId: idKomentar,
        content,
        authorId: req.user!.id,
      },
      include: { author: { select: { role: true, profile: { select: { nama: true } } } } },
    });

    res.status(201).json({
      message: 'Balasan berhasil ditambahkan.',
      data: newReply,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/public-comments/:commentId/replies/:replyId
// Edit isi balasan (hanya oleh admin/pengurus yang membuatnya, atau admin lain)
export const updateReply = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { commentId, replyId } = req.params;

    const reply = await prisma.publicCommentReply.findUnique({
      where: { id: replyId },
      include: { author: { select: { id: true, role: true, profile: { select: { nama: true } } } } },
    });

    if (!reply) {
      res.status(404).json({ message: 'Balasan tidak ditemukan.' });
      return;
    }

    if (reply.authorId !== req.user?.id && !isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Anda tidak berhak mengedit balasan ini.' });
      return;
    }

    const parsed = validateReplyPatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: (parsed.error as any).issues?.[0]?.message || (parsed.error as any).errors?.[0]?.message || 'Data tidak valid.' });
      return;
    }

    const updated = await prisma.publicCommentReply.update({
      where: { id: replyId },
      data: {
        content: parsed.data.content ?? reply.content,
        authorId: parsed.data.authorId ?? reply.authorId,
      },
      include: { author: { select: { role: true, profile: { select: { nama: true } } } } },
    });

    await logActivity(
      req.user!.id,
      'UPDATE_PUBLIC_REPLY',
      'PublicCommentReply',
      `Memperbarui balasan "${reply.content.substring(0, 80)}${reply.content.length > 80 ? '...' : ''}" -> "${updated.content.substring(0, 80)}${updated.content.length > 80 ? '...' : ''}"`,
      replyId,
    );

    res.json({
      message: 'Balasan berhasil diperbarui.',
      data: {
        id: updated.id,
        content: updated.content,
        createdAt: updated.createdAt,
        authorId: updated.authorId,
        penulis: updated.author.profile?.nama ?? 'Admin',
        role: updated.author.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/public-comments/:commentId/replies/:replyId
// Hapus balasan (hanya oleh admin/pengurus yang membuatnya, atau admin lain)
export const deleteReply = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { replyId } = req.params;

    const reply = await prisma.publicCommentReply.findUnique({
      where: { id: replyId },
      include: { author: { select: { id: true, role: true } } },
    });

    if (!reply) {
      res.status(404).json({ message: 'Balasan tidak ditemukan.' });
      return;
    }

    if (reply.authorId !== req.user?.id && !isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Anda tidak berhak menghapus balasan ini.' });
      return;
    }

    await prisma.publicCommentReply.delete({ where: { id: replyId } });

    await logActivity(
      (req as any).user.id,
      'DELETE_PUBLIC_REPLY',
      'PublicCommentReply',
      `Menghapus balasan dari ${(reply as any).author?.profile?.nama ?? reply.authorId ?? 'admin'}`,
      replyId,
    );

    res.json({ message: 'Balasan berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

// ─── Lapor komentar/publik → kontak admin via notifikasi ───────────────────
// POST /api/public-comments/:commentId/report
// Pengguna yang login bisa melaporkan sebuah komentar; sistem akan membuat
// notifikasi ke admin dan menandai komentar untuk ditinjau.
export const reportComment = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body as { reason?: string };

    const reporter = req.user;
    if (!reporter) {
      res.status(401).json({ message: 'Harap login untuk melaporkan komentar.' });
      return;
    }

    const comment = await prisma.publicComment.findUnique({
      where: { id: commentId },
      select: { id: true, nama: true, status: true },
    });

    if (!comment) {
      res.status(404).json({ message: 'Komentar tidak ditemukan.' });
      return;
    }

    if (comment.status === 'REJECTED') {
      res.status(400).json({ message: 'Komentar ini sudah ditolak, tidak perlu dilaporkan.' });
      return;
    }

    if (comment.status === 'PENDING') {
      res.status(400).json({ message: 'Komentar ini masih menunggu persetujuan, laporan tidak diperlukan.' });
      return;
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
      select: { id: true, profile: { select: { nama: true } } },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Laporan Komentar Baru',
          message: `Komentar dari ${comment.nama} dilaporkan oleh pengguna: ${reason ? reason : 'Tidak ada alasan yang diberikan'}`,
          isRead: false,
        },
      });
    }

    await logActivity(
      reporter.id,
      'REPORT_PUBLIC_COMMENT',
      'PublicCommentReply',
      `Melaporkan komentar dari ${comment.nama} dengan alasan: ${reason || 'Tidak ada alasan'}`,
      commentId,
    );

    res.json({ message: 'Laporan komentar berhasil dikirim. Terima kasih atas bantuannya.' });
  } catch (error) {
    next(error);
  }
};

// ─── Setelahnya, prevent comment creation jika email diblokir ───────────────
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nama, asal_kampus, email, no_hp, content } = req.body;

    if (!nama || !asal_kampus || !email || !no_hp || !content) {
      res.status(400).json({ message: 'Semua kolom wajib diisi.' });
      return;
    }


    const newComment = await prisma.publicComment.create({
      data: { nama, asal_kampus, email, no_hp, content },
    });

    res.status(201).json({
      message: 'Pesan berhasil dikirim dan akan tayang setelah ditinjau pengurus. Terima kasih!',
      data: { id: newComment.id, nama: newComment.nama, createdAt: newComment.createdAt },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Listing publik & manajemen ────────────────────────────────────────────
export const getPublicComments = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const comments = await prisma.publicComment.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          // Foto pengurus/admin ikut dikirim: halaman buku tamu bersifat publik,
          // jadi pengunjung boleh melihat foto profil penulis balasan.
          include: {
            author: {
              select: { id: true, role: true, foto: true, profile: { select: { nama: true, foto: true } } },
            },
          },
        },
      },
    });

    const data = comments.map((c: any) => ({
      id: c.id,
      nama: c.nama,
      asal_kampus: c.asal_kampus,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt,
      balasan: c.replies.map((r: any) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        penulis: r.author?.profile?.nama ?? 'Admin',
        role: r.author?.role ?? 'ADMIN',
        foto: r.author?.foto ?? r.author?.profile?.foto ?? null,
        // null untuk data lama tanpa akun; avatar hanya bisa diklik jika ada ID.
        userId: r.author?.id ?? null,
      })),
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

export const getCommentsForManagement = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { status } = req.query as { status?: string };
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const [comments, total, menunggu, disetujui, ditolak] = await Promise.all([
      prisma.publicComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: { id: true, role: true, foto: true, profile: { select: { nama: true, foto: true } } },
              },
            },
          },
        },
      }),
      prisma.publicComment.count(),
      prisma.publicComment.count({ where: { status: 'PENDING' } }),
      prisma.publicComment.count({ where: { status: 'APPROVED' } }),
      prisma.publicComment.count({ where: { status: 'REJECTED' } }),
    ]);

    const data = comments.map((c: any) => ({
      id: c.id,
      nama: c.nama,
      asal_kampus: c.asal_kampus,
      email: c.email,
      no_hp: c.no_hp,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt,
      moderatedAt: (c as any).moderatedAt ?? null,
      ditinjauOleh: (c as any).ditinjauOleh ?? null,
      balasan: c.replies.map((r: any) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        penulis: r.author?.profile?.nama ?? 'Admin',
        role: r.author?.role ?? 'ADMIN',
        foto: r.author?.foto ?? r.author?.profile?.foto ?? null,
        userId: r.author?.id ?? null,
      })),
    }));

    res.json({ data, meta: { total, menunggu, disetujui, ditolak } });
  } catch (error) {
    next(error);
  }
};

export const ubahStatusKomentar = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!canModerateComment(req, res)) return;

    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Status tidak valid.' });
      return;
    }

    const comment = await prisma.publicComment.findUnique({ where: { id } });
    if (!comment) {
      res.status(404).json({ message: 'Komentar tidak ditemukan.' });
      return;
    }

    const updated = await prisma.publicComment.update({
      where: { id },
      data: { status: status as any },
    });

    await logActivity(
      (req as any).user!.id,
      'UPDATE_PUBLIC_COMMENT_STATUS',
      'PublicComment',
      `Mengubah status komentar dari ${comment.status} menjadi ${status}`,
      id,
    );

    res.json({ message: 'Status komentar berhasil diperbarui.', data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/public-comments/manage/:id
// Hapus permanen satu pesan buku tamu beserta seluruh balasannya.
// Khusus ADMIN/SUPERADMIN: penghapusan ini bersifat permanen, jadi lebih kuat
// daripada sekadar menolak (REJECTED) yang masih bisa dikembalikan ke antrean.
export const hapusKomentar = async (req: Permintaan, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Harus login untuk menghapus pesan.' });
      return;
    }
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya admin dan superadmin yang dapat menghapus pesan buku tamu.' });
      return;
    }

    const { id } = req.params;
    const komentar = await prisma.publicComment.findUnique({
      where: { id },
      select: { id: true, nama: true, content: true },
    });

    if (!komentar) {
      res.status(404).json({ message: 'Pesan tidak ditemukan.' });
      return;
    }

    // Balasan ikut terhapus oleh ON DELETE CASCADE
    // (migration 20261016090000_komentar_publik_dan_perpanjangan_akun).
    await prisma.publicComment.delete({ where: { id: komentar.id } });

    await logActivity(
      req.user.id,
      'DELETE_PUBLIC_COMMENT',
      'PublicComment',
      `Menghapus pesan buku tamu dari ${komentar.nama}: "${komentar.content.substring(0, 80)}${komentar.content.length > 80 ? '...' : ''}"`,
      komentar.id,
    );

    res.json({ message: 'Pesan beserta seluruh balasannya berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

