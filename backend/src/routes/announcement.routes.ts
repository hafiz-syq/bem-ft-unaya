import { Router } from 'express';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getManagedAnnouncements,
  markAnnouncementRead,
  updateAnnouncement,
} from '../controllers/announcement.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getAnnouncements);
router.get('/manage', getManagedAnnouncements);
router.post('/', createAnnouncement);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.post('/:id/read', markAnnouncementRead);

export default router;
