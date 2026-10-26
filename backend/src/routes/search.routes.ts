import { Router } from 'express';
import { globalSearch } from '../controllers/search.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, globalSearch);

export default router;
