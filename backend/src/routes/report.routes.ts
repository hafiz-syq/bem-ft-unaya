import { Router } from 'express';
import { downloadMonthlyReport } from '../controllers/report.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/monthly', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), downloadMonthlyReport);

export default router;
