"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const public_comment_controller_1 = require("../controllers/public-comment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ticket_access_1 = require("../lib/ticket-access");
const router = (0, express_1.Router)();
// --- Pengurus & admin: meninjau dan membalas -----------------------------
// Didaftarkan lebih dulu agar /manage tidak pernah tertutup rute publik di bawah.
const pengelola = [auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN', ...ticket_access_1.OFFICER_ROLES])];
router.get('/manage', ...pengelola, public_comment_controller_1.getCommentsForManagement);
router.patch('/manage/:id/status', ...pengelola, public_comment_controller_1.ubahStatusKomentar);
router.post('/manage/:id/replies', ...pengelola, public_comment_controller_1.balasKomentar);
// --- Publik (tanpa login) ------------------------------------------------
// Baca hanya menampilkan komentar yang sudah disetujui dan tanpa data kontak
// pengirim; kirim pesan selalu masuk antrean tinjauan (status PENDING).
router.get('/', public_comment_controller_1.getPublicComments);
router.post('/', public_comment_controller_1.createComment);
// --- Endpoints tambahan untuk manajemen detail (admin/pengurus) ----------
router.get('/:commentId/replies', ...pengelola, public_comment_controller_1.getRepliesForComment);
router.patch('/:commentId/replies/:replyId', ...pengelola, public_comment_controller_1.updateReply);
router.delete('/:commentId/replies/:replyId', ...pengelola, public_comment_controller_1.deleteReply);
router.post('/:commentId/report', auth_middleware_1.requireAuth, public_comment_controller_1.reportComment);
const publicCommentRouter = router;
exports.default = publicCommentRouter;
