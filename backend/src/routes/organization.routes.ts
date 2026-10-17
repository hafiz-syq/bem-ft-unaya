import { Router } from 'express';
import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
  createDepartment,
  deleteDepartment,
} from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Master organisasi adalah area admin (lihat menu "Master Organisasi").
router.use(requireAuth, requireRole(['ADMIN']));

router.get('/', getOrganizations);
router.post('/', createOrganization);
router.post('/departments', createDepartment);
router.delete('/departments/:id', deleteDepartment);

// Hapus organisasi beserta divisi & slot jabatannya (butuh force=true bila masih
// menyimpan riwayat jabatan lama).
router.delete('/:id', deleteOrganization);

export default router;
