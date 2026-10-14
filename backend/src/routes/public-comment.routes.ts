import { Router } from 'express';
import { createComment, getPublicComments } from '../controllers/public-comment.controller';

const router = Router();

router.get('/', getPublicComments); // <-- INI YANG BIKIN DATA TAMPIL DI LANDING PAGE
router.post('/', createComment);

export default router;