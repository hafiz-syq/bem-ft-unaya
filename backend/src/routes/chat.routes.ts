import { Router } from 'express';
import {
  approveRoom,
  createRoom,
  deleteMessage,
  deleteRoom,
  getForumFilter,
  getForumStatus,
  getMessages,
  getRooms,
  saveForumFilter,
  sendMessage,
  setRoomStatus,
} from '../controllers/chat.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// Ruang forum yang menumpuk membanjiri daftar komunitas, dan pembuatnya adalah
// akun yang sudah dipercaya. Dibatasi per PENGGUNA karena satu alamat keluar
// kampus dipakai bersama.
// shortcut: penyimpanan limiter bawaan ada di memori proses, jadi hitungan
// ulang saat instance berganti; pindah ke Redis bila batas harus keras.
const batasRuangLogin = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak ruang forum dibuat dari akun ini. Coba lagi nanti.' },
});

// Seluruh rute forum memerlukan login: forum adalah ruang komunitas akun,
// bukan halaman publik. Pembatasan peran (pembuat/penutup ruang) diperiksa
// di controller supaya pesan penolakan bisa lebih menjelaskan.
router.use(requireAuth);

router.get('/status', getForumStatus);
router.get('/filter', getForumFilter);
router.put('/filter', saveForumFilter);
router.get('/rooms', getRooms);
router.post('/rooms', batasRuangLogin, createRoom);
router.patch('/rooms/:id', setRoomStatus);
router.post('/rooms/:id/approve', approveRoom);
router.delete('/rooms/:id', deleteRoom);
router.get('/rooms/:id/messages', getMessages);
router.post('/rooms/:id/messages', sendMessage);
router.delete('/messages/:id', deleteMessage);

export default router;
