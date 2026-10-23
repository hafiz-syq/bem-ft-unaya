// position.routes.ts
import { Router } from 'express';
import {
  createPositionSlot,
  updatePositionSlot,
  deletePositionSlot,
  assignPosition,
  getPositions,
  removePosition,
} from '../controllers/position.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getPositions);
router.post('/slots', requireAuth, createPositionSlot);
// Ubah & hapus slot jabatan (nama, organisasi, divisi). Diletakkan sebelum
// rute '/:id' agar 'slots' tidak terbaca sebagai ID position.
router.patch('/slots/:id', requireAuth, updatePositionSlot);
router.delete('/slots/:id', requireAuth, deletePositionSlot);
router.post('/assign', requireAuth, assignPosition);
router.delete('/:id', requireAuth, removePosition);

export default router;