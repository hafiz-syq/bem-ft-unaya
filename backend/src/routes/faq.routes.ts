import { Router } from 'express';
import { getFaqs, createFaq, updateFaq, deleteFaq } from '../controllers/faq.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Semua pengguna yang login boleh membaca FAQ (halaman ada di DashboardLayout).
router.get('/', requireAuth, getFaqs);

// Pengelolaan FAQ khusus admin.
router.post('/', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), createFaq);
router.put('/:id', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), updateFaq);
router.delete('/:id', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), deleteFaq);

export default router;
