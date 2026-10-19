import { Router } from 'express';
import {
  konversiGambarDariUrl,
  previewKonversiGambar,
  validasiUrlGambar,
} from '../controllers/image-convert.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { OFFICER_ROLES } from '../lib/ticket-access';

const router = Router();

// Pengelola gambar = admin + seluruh jenis pengurus (sama dengan cms.routes).
const pengelola = [requireAuth, requireRole(['ADMIN', 'SUPERADMIN', ...OFFICER_ROLES])];

router.post('/konversi', ...pengelola, konversiGambarDariUrl);
router.get('/preview', ...pengelola, previewKonversiGambar);
router.post('/validasi-url', ...pengelola, validasiUrlGambar);

export default router;
