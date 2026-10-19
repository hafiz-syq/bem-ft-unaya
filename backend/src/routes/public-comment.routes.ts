import { Router } from 'express';
import {
  createComment,
  getPublicComments,
  getCommentsForManagement,
  ubahStatusKomentar,
  balasKomentar,
  updateReply,
  deleteReply,
  reportComment,
  getRepliesForComment,
} from '../controllers/public-comment.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { OFFICER_ROLES } from '../lib/ticket-access';

const router = Router();

// --- Pengurus & admin: meninjau dan membalas -----------------------------
// Didaftarkan lebih dulu agar /manage tidak pernah tertutup rute publik di bawah.
const pengelola = [requireAuth, requireRole(['ADMIN', 'SUPERADMIN', ...OFFICER_ROLES])];

router.get('/manage', ...pengelola, getCommentsForManagement);
router.patch('/manage/:id/status', ...pengelola, ubahStatusKomentar);
router.post('/manage/:id/replies', ...pengelola, balasKomentar);

// --- Publik (tanpa login) ------------------------------------------------
// Baca hanya menampilkan komentar yang sudah disetujui dan tanpa data kontak
// pengirim; kirim pesan selalu masuk antrean tinjauan (status PENDING).
router.get('/', getPublicComments);
router.post('/', createComment);

// --- Endpoints tambahan untuk manajemen detail (admin/pengurus) ----------
router.get('/:commentId/replies', ...pengelola, getRepliesForComment);
router.patch('/:commentId/replies/:replyId', ...pengelola, updateReply);
router.delete('/:commentId/replies/:replyId', ...pengelola, deleteReply);
router.post('/:commentId/report', requireAuth, reportComment);


const publicCommentRouter = router;
export default publicCommentRouter;
