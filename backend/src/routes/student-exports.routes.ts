import { Router } from 'express';
import { exportMahasiswa } from '../controllers/student-exports.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Hanya admin yang bisa mengekspor data mahasiswa
router.get('/export', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), exportMahasiswa);

export default router;
