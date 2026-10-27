import { Router } from 'express';
import {
  createDocument,
  deleteDocument,
  getAksesArsip,
  getDocuments,
  reviewDocument,
  submitDocument,
  updateDocument,
} from '../controllers/document.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadDokumen } from '../middlewares/upload.middleware';

const router = Router();

router.use(requireAuth);

// Pemeriksaan ringan untuk sidebar & halaman arsip. Ditaruh sebelum rute lain
// agar tidak bergantung pada pola ':id' yang mungkin ditambahkan kemudian.
router.get('/akses', getAksesArsip);

router.get('/', getDocuments);
router.post('/', uploadDokumen.single('file'), createDocument);
router.put('/:id', uploadDokumen.single('file'), updateDocument);
router.post('/:id/submit', submitDocument);
router.patch('/:id/review', reviewDocument);
router.delete('/:id', deleteDocument);

export default router;
