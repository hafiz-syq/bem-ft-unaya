import { Router } from 'express';
import {
  getStudents,
  createStudent,
  createAdminAccount,
  updateStudentStatus,
  perpanjangAkun,
  updateStudentRole,
  updateStudent,
  deleteStudent,
  runLifecycle,
  requireOfficer,
  requireAdmin,
} from '../controllers/student.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { uploadPdfImpor } from '../middlewares/upload.middleware';
import { pratinjauImpor, simpanImpor } from '../controllers/student-import.controller';
import {
  bulkStudents,
  getTrashStudents,
  restoreStudent,
  deleteStudentPermanent,
} from '../controllers/student-bulk.controller';

const router = Router();

// Semua rute di sini wajib login. Daftar mahasiswa boleh dibaca akun
// MAHASISWA (dengan data terbatas, lihat getStudents), sedangkan seluruh
// tindakan pengelolaan tetap hanya untuk pengurus & admin.
router.use(requireAuth);

// Pemeriksaan siklus hidup akun secara manual (admin saja).
router.post('/maintenance/run-lifecycle', requireOfficer, requireAdmin, runLifecycle);

// Impor massal dari PDF (admin saja). Dua langkah: pratinjau dulu, baru simpan.
router.post('/import/pratinjau', requireOfficer, requireAdmin, uploadPdfImpor.single('file'), pratinjauImpor);
router.post('/import/simpan', requireOfficer, requireAdmin, uploadPdfImpor.single('file'), simpanImpor);

// Rute statis harus didaftarkan sebelum rute berparameter /:id.
router.get('/trash', requireOfficer, requireAdmin, getTrashStudents);
router.patch('/bulk', requireOfficer, requireAdmin, bulkStudents);

// Daftar mahasiswa: pengurus, admin, dan akun mahasiswa (data terbatas).  router.get('/', requireAuth, getStudents);
// Tambah satu akun mahasiswa secara manual (tanpa PDF), khusus ADMIN/SUPERADMIN.
router.post('/', requireOfficer, requireAdmin, createStudent);
// Tambah akun administrator baru, khusus SUPERADMIN.
router.post('/admin', requireRole(['SUPERADMIN']), createAdminAccount);
router.patch('/:id/status', requireOfficer, updateStudentStatus);
// Perpanjangan masa studi & geser tenggat hapus: hanya admin, karena menyangkut
// keberadaan akun.
router.patch('/:id/perpanjangan', requireOfficer, requireAdmin, perpanjangAkun);
router.patch('/:id/role', requireOfficer, requireAdmin, updateStudentRole);
// Sunting data profil mahasiswa: ADMIN & SUPERADMIN.
router.put('/:id', requireOfficer, requireAdmin, updateStudent);
// Hapus dari daftar: superadmin, dipindahkan ke tempat sampah 30 hari.
router.delete('/:id', requireRole(['SUPERADMIN']), deleteStudent);
// Pemulihan & penghapusan permanen dari tempat sampah (khusus SUPERADMIN).
router.put('/:id/restore', requireRole(['SUPERADMIN']), restoreStudent);
router.delete('/:id/permanent', requireRole(['SUPERADMIN']), deleteStudentPermanent);

export default router;
