// position.routes.ts
import { Router } from 'express';
import { createPositionSlot, assignPosition, getPositions, removePosition } from '../controllers/position.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getPositions);
router.post('/slots', requireAuth, createPositionSlot);
router.post('/assign', requireAuth, assignPosition);
router.delete('/:id', requireAuth, removePosition);

export default router;