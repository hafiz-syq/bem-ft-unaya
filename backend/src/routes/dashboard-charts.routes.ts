import { Router } from 'express';
import {
  getDashboardCharts,
  exportImporCsv,
} from '../controllers/dashboard-charts.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { OFFICER_ROLES } from '../lib/ticket-access';

const router = Router();

// Hanya admin atau pengurus yang bisa melihat grafik dashboard
router.get('/charts', requireAuth, requireRole(['ADMIN', 'SUPERADMIN', ...OFFICER_ROLES]), getDashboardCharts);

// Endpoint khusus untuk mendownload CSV laporan impor (bisa dipanggil tanpa auth,
// namun tetap pakai rate-limit internal di app.ts jika perlu)
router.get('/charts/export-impor', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), exportImporCsv);

export default router;
