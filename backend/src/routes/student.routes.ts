import { Router } from 'express';
import { getStudents } from '../controllers/student.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// HANYA Admin dan Pengurus yang boleh mengakses daftar mahasiswa
// (Meskipun requireAuth saja belum cukup ketat, nanti kita buatkan middleware RBAC. 
// Untuk sekarang, kita pastikan rute ini tertutup dari luar).
router.get('/', requireAuth, getStudents);

export default router;