import { Router } from 'express';
import { getPerangkat, kelolaPerangkat, aturBatasPerangkat } from '../controllers/device.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { ADMIN_ROLES } from '../lib/ticket-access';

const router = Router();

// Hanya ADMIN & SUPERADMIN. Aturan tambahan (admin biasa tidak boleh mengelola
// akun ADMIN/SUPERADMIN lain) dijaga di controller.
router.use(requireAuth, requireRole(ADMIN_ROLES));

router.get('/', getPerangkat);
router.post('/:id/reset', kelolaPerangkat);
// Atur jumlah perangkat yang boleh aktif bersamaan untuk satu akun.
router.patch('/:id/batas', aturBatasPerangkat);

export default router;
