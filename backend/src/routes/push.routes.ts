import { Router } from 'express';
import { getPushPublicKey, subscribePush, unsubscribePush } from '../controllers/push.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/public-key', requireAuth, getPushPublicKey);
router.post('/subscribe', requireAuth, subscribePush);
router.post('/unsubscribe', requireAuth, unsubscribePush);

export default router;
