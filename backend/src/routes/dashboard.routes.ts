import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { getDashboardStatistik } from '../controllers/dashboard-statistik.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/stats', requireAuth, getDashboardStats);
// Statistik + deret grafik untuk semua role (mahasiswa, pengurus, admin).
router.get('/statistik', requireAuth, getDashboardStatistik);

export default router;