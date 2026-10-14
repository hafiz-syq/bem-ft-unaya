import { Router } from 'express';
import { createRequest, getRequests, processRequest } from '../controllers/data-request.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, getRequests);
router.post('/', requireAuth, createRequest);
// Endpoint khusus Admin/Pengurus untuk meninjau pengajuan
router.put('/:id/process', requireAuth, processRequest);

export default router;