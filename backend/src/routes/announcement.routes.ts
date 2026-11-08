import { Router } from 'express';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getManagedAnnouncements,
  markAnnouncementRead,
  updateAnnouncement,
} from '../controllers/announcement.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const router = Router();

// Satu pengumuman bisa menyiar ke seluruh akun aktif (baris Notification + web
// push per penerima), jadi jalur tulisnya dibatasi per PENGGUNA, bukan per IP:
// seluruh kampus berbagi satu alamat keluar.
// shortcut: penyimpanan limiter bawaan ada di memori proses, jadi hitungan
// ulang saat instance berganti; pindah ke Redis bila batas harus keras.
const batasUmumLogin = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak pengumuman dibuat dari akun ini. Coba lagi nanti.' },
});

router.use(requireAuth);

router.get('/', getAnnouncements);
router.get('/manage', getManagedAnnouncements);
router.post('/', batasUmumLogin, createAnnouncement);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.post('/:id/read', markAnnouncementRead);

export default router;
