import { Router } from 'express';
import {
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

const router = Router();

// Seluruh rute forum memerlukan login: forum adalah ruang komunitas akun,
// bukan halaman publik. Pembatasan peran (pembuat/penutup ruang) diperiksa
// di controller supaya pesan penolakan bisa lebih menjelaskan.
router.use(requireAuth);

router.get('/status', getForumStatus);
router.get('/filter', getForumFilter);
router.put('/filter', saveForumFilter);
router.get('/rooms', getRooms);
router.post('/rooms', createRoom);
router.patch('/rooms/:id', setRoomStatus);
router.delete('/rooms/:id', deleteRoom);
router.get('/rooms/:id/messages', getMessages);
router.post('/rooms/:id/messages', sendMessage);
router.delete('/messages/:id', deleteMessage);

export default router;
