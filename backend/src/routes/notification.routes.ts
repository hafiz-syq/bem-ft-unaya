import { Router } from 'express';
import { getNotifications, markAllAsRead } from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.put('/read-all', requireAuth, markAllAsRead);

export default router;