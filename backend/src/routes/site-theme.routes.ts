import { Router } from 'express';
import { getTemaMusiman, updateTemaMusiman } from '../controllers/site-theme.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Publik: halaman depan perlu membaca tema aktif sebelum login.
router.get('/', getTemaMusiman);

// Hanya SUPERADMIN: tema berlaku untuk semua pengunjung.
router.put('/', requireAuth, requireRole(['SUPERADMIN']), updateTemaMusiman);

export default router;
