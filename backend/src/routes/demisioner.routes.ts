import { Router } from 'express';
import {
  getDemisioner,
  createDemisioner,
  updateDemisioner,
  deleteDemisioner,
} from '../controllers/demisioner.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { uploadPhoto } from '../middlewares/upload.middleware';

const router = Router();

// Publik: landing & halaman riwayat demisioner.
router.get('/', getDemisioner);

// Admin: mengelola riwayat demisioner.
router.post('/', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), uploadPhoto.single('foto'), createDemisioner);
router.put('/:id', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), uploadPhoto.single('foto'), updateDemisioner);
router.delete('/:id', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), deleteDemisioner);

export default router;
