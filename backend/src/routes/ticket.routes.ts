import { Router } from 'express';
import {
  createTicket,
  getTickets,
  getPublicTickets,
  replyTicket,
  getAssignees,
  assignTicket,
  setTicketModeration,
  exportKeluhanExcel,
} from '../controllers/ticket.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { denganWebp, uploadAttachment } from '../middlewares/upload.middleware';
import {
  createTicketTemplate,
  deleteTicketTemplate,
  getTicketTemplates,
  rateTicket,
  setTicketPriority,
  updateTicketTemplate,
} from '../controllers/ticket-extra.controller';

const router = Router();

// Rute statis WAJIB di atas rute dinamis (/:id) agar tidak tertimpa.
router.get('/public', getPublicTickets);
router.get('/assignees', requireAuth, getAssignees);
router.get('/export/keluhan', requireAuth, exportKeluhanExcel);
// Template balasan cepat untuk pengurus & admin.
router.get('/templates', requireAuth, getTicketTemplates);
router.post('/templates', requireAuth, createTicketTemplate);
router.put('/templates/:id', requireAuth, updateTicketTemplate);
router.delete('/templates/:id', requireAuth, deleteTicketTemplate);

router.get('/', requireAuth, getTickets);
const unggahLampiran = denganWebp(uploadAttachment);
router.post('/', requireAuth, unggahLampiran.single('file'), createTicket);
router.post('/:id/replies', requireAuth, replyTicket);
router.post('/:id/assign', requireAuth, assignTicket);
router.put('/:id/moderation', requireAuth, setTicketModeration);
router.patch('/:id/priority', requireAuth, setTicketPriority);
router.post('/:id/rating', requireAuth, rateTicket);

export default router;
