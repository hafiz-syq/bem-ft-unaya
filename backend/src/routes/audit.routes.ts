import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Hanya admin yang bisa melihat log aktivitas
router.get('/', requireAuth, getAuditLogs);

export default router;