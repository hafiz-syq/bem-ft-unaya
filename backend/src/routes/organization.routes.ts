import { Router } from 'express';
import { getOrganizations, createOrganization, createDepartment } from '../controllers/organization.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Middleware requireAuth memastikan hanya user yang login yang bisa akses.
// (Nantinya di sisi Frontend, halaman ini hanya ditampilkan untuk Admin).

router.get('/', requireAuth, getOrganizations);
router.post('/', requireAuth, createOrganization);
router.post('/departments', requireAuth, createDepartment);

export default router;