import { Router } from 'express';
import { createTicket, getTickets, replyTicket, getAssignees, assignTicket } from '../controllers/ticket.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadAttachment } from '../middlewares/upload.middleware'; // <-- Import middleware

const router = Router();

router.get('/', requireAuth, getTickets);
router.post('/', requireAuth, uploadAttachment.single('file'), createTicket); 
router.post('/:id/replies', requireAuth, replyTicket);
router.get('/assignees', requireAuth, getAssignees);
router.post('/:id/assign', requireAuth, assignTicket);

export default router;