import { Router } from 'express';
import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
  createDepartment,
  deleteDepartment,
  renameOrganization,
  renameDepartment,
} from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Master organisasi adalah area admin (lihat menu "Master Organisasi").
router.use(requireAuth, requireRole(['ADMIN', 'SUPERADMIN']));

router.get('/', getOrganizations);
router.post('/', createOrganization);
router.post('/departments', createDepartment);
router.patch('/departments/:id', renameDepartment);
router.delete('/departments/:id', deleteDepartment);

// Ganti nama organisasi (hanya nama; struktur dan riwayat jabatan tetap).
router.patch('/:id', renameOrganization);

// Hapus organisasi beserta divisi & slot jabatannya (butuh force=true bila masih
// menyimpan riwayat jabatan lama).
router.delete('/:id', deleteOrganization);

export default router;
