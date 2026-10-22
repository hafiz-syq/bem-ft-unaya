import { Router } from 'express';
import {
  getStudents,
  createStudent,
  createAdminAccount,
  updateStudentStatus,
  perpanjangAkun,
  updateStudentRole,
  runLifecycle,
  requireOfficer,
  requireAdmin,
} from '../controllers/student.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { uploadPdfImpor } from '../middlewares/upload.middleware';
import { pratinjauImpor, simpanImpor } from '../controllers/student-import.controller';

const router = Router();

// Semua rute di sini hanya untuk pengurus & admin.
router.use(requireAuth, requireOfficer);

// Pemeriksaan siklus hidup akun secara manual (admin saja).
router.post('/maintenance/run-lifecycle', requireAdmin, runLifecycle);

// Impor massal dari PDF (admin saja). Dua langkah: pratinjau dulu, baru simpan.
router.post('/import/pratinjau', requireAdmin, uploadPdfImpor.single('file'), pratinjauImpor);
router.post('/import/simpan', requireAdmin, uploadPdfImpor.single('file'), simpanImpor);

router.get('/', getStudents);
// Tambah satu akun mahasiswa secara manual (tanpa PDF), khusus ADMIN/SUPERADMIN.
router.post('/', requireAdmin, createStudent);
// Tambah akun administrator baru, khusus SUPERADMIN.
router.post('/admin', requireRole(['SUPERADMIN']), createAdminAccount);
router.patch('/:id/status', updateStudentStatus);
// Perpanjangan masa studi & geser tenggat hapus: hanya admin, karena menyangkut
// keberadaan akun.
router.patch('/:id/perpanjangan', requireAdmin, perpanjangAkun);
router.patch('/:id/role', requireAdmin, updateStudentRole);

export default router;
