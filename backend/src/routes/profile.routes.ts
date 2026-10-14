import { Router } from 'express';
import { getMyProfile, updateMyEmail } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint untuk mengambil profil diri sendiri
router.get('/me', requireAuth, getMyProfile);

// Endpoint untuk mengubah email pribadi (tersedia untuk semua pengguna yang login)
router.put('/me', requireAuth, updateMyEmail);

export default router;