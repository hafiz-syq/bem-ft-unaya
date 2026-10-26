import { Router } from 'express';
import {
  clearResolvedErrors,
  getErrorLogs,
  resolveErrorLog,
} from '../controllers/error-log.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth, requireRole(['ADMIN', 'SUPERADMIN']));
router.get('/', getErrorLogs);
router.patch('/:id', resolveErrorLog);
router.delete('/resolved', clearResolvedErrors);

export default router;
