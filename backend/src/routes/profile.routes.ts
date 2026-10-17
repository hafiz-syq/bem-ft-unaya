import { Router } from 'express';
import { getMyProfile, updateMyEmail, uploadMyPhoto } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadPhoto } from '../middlewares/upload.middleware';

const router = Router();

// Endpoint untuk mengambil profil diri sendiri (biodata lengkap + foto)
router.get('/me', requireAuth, getMyProfile);

// Endpoint untuk mengubah email pribadi (tersedia untuk semua pengguna yang login)
router.put('/me', requireAuth, updateMyEmail);

// Endpoint untuk mengunggah / mengganti foto profil (semua role)
router.post('/me/photo', requireAuth, uploadPhoto.single('foto'), uploadMyPhoto);

export default router;
