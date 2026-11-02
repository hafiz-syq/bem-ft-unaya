import { Router } from 'express';
import {
  createComment,
  getPublicComments,
  getCommentsForManagement,
  ubahStatusKomentar,
  hapusKomentar,
  pulihkanKomentar,
  hapusKomentarPermanen,
  balasKomentar,
  updateReply,
  deleteReply,
  reportComment,
  laporkanKomentarPublik,
  getRepliesForComment,
} from '../controllers/public-comment.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { OFFICER_ROLES } from '../lib/ticket-access';
import rateLimit from 'express-rate-limit';

// Laporan publik tidak butuh login, jadi dibatasi per IP agar tidak dipakai
// untuk membanjiri antrean moderasi.
const batasLaporan = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak laporan dari perangkat ini. Coba lagi nanti.' },
});

// Pengiriman komentar tamu juga dibatasi per IP: tanpa ini siapa pun bisa
// membanjiri antrean moderasi (dan menyimpan teks sampah di database).
const batasKomentar = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak komentar dari perangkat ini. Coba lagi beberapa menit lagi.' },
});

const router = Router();

// --- Pengurus & admin: meninjau dan membalas -----------------------------
// Didaftarkan lebih dulu agar /manage tidak pernah tertutup rute publik di bawah.
const pengelola = [requireAuth, requireRole(['ADMIN', 'SUPERADMIN', ...OFFICER_ROLES])];

router.get('/manage', ...pengelola, getCommentsForManagement);
router.patch('/manage/:id/status', ...pengelola, ubahStatusKomentar);
router.post('/manage/:id/replies', ...pengelola, balasKomentar);
// Hapus permanen pesan beserta balasannya. Penjaga peran (khusus ADMIN/
// SUPERADMIN) ada di controller via isAdminRole, bukan di sini, supaya pesan
// penolakan yang dikembalikan ke pengurus tetap berbahasa Indonesia yang jelas.
router.delete('/manage/:id', ...pengelola, hapusKomentar);
router.post('/manage/:id/restore', ...pengelola, pulihkanKomentar);
router.delete('/manage/:id/permanent', ...pengelola, hapusKomentarPermanen);

// --- Publik (tanpa login) ------------------------------------------------
// Baca hanya menampilkan komentar yang sudah disetujui dan tanpa data kontak
// pengirim; kirim pesan selalu masuk antrean tinjauan (status PENDING).
router.get('/', getPublicComments);  router.post('/', batasKomentar, createComment);

// --- Endpoints tambahan untuk manajemen detail (admin/pengurus) ----------
router.get('/:commentId/replies', ...pengelola, getRepliesForComment);
router.patch('/:commentId/replies/:replyId', ...pengelola, updateReply);
router.delete('/:commentId/replies/:replyId', ...pengelola, deleteReply);
router.post('/:commentId/report', requireAuth, reportComment);
// Tombol "Laporkan" untuk pengunjung tanpa akun di halaman buku tamu publik.
router.post('/:commentId/laporkan', batasLaporan, laporkanKomentarPublik);


const publicCommentRouter = router;
export default publicCommentRouter;
