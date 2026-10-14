import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/stats', requireAuth, getDashboardStats);

export default router;