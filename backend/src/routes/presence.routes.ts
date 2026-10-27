import { Router } from 'express';
import { heartbeatPresence, getOnlineUsers } from '../controllers/presence.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Semua pengguna login boleh menandai dirinya aktif dan melihat siapa saja
// yang sedang membuka situs. Tamu tidak punya identitas, jadi tidak dihitung.
router.post('/heartbeat', requireAuth, heartbeatPresence);
router.get('/online', requireAuth, getOnlineUsers);

export default router;
