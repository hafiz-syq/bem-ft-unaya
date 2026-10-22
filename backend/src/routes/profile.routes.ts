import { Router } from 'express';
import { getMyProfile, updateMyEmail, uploadMyPhoto, deleteMyPhoto } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadFotoMemori } from '../middlewares/upload.middleware';

const router = Router();

// Endpoint untuk mengambil profil diri sendiri (biodata lengkap + foto)
router.get('/me', requireAuth, getMyProfile);

// Endpoint untuk mengubah email pribadi (tersedia untuk semua pengguna yang login)
router.put('/me', requireAuth, updateMyEmail);

// Endpoint untuk mengunggah / mengganti foto profil (semua role).
// Berkas dibaca dari memori lalu dikirim ke Cloudinary oleh controller, jadi
// tidak ada penulisan ke disk yang hilang di server tanpa filesystem permanen.
router.post('/me/photo', requireAuth, uploadFotoMemori.single('foto'), uploadMyPhoto);

// Menghapus foto profil sendiri (semua role).
router.delete('/me/photo', requireAuth, deleteMyPhoto);

export default router;
