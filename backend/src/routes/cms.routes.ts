import { Router } from 'express';
import { 
  getContents, createContent, deleteContent, getContentById,
  getAgendas, createAgenda, deleteAgenda,
  getGalleries, createGallery, deleteGallery,
  getPublicStructure
} from '../controllers/cms.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { uploadAttachment } from '../middlewares/upload.middleware'; 

const router = Router();

// Rute Agenda & Galeri & Struktur (Harus di atas /:id agar tidak tertimpa)
router.get('/agendas', getAgendas);
router.post('/agendas', requireAuth, createAgenda);
router.delete('/agendas/:id', requireAuth, deleteAgenda);

router.get('/galleries', getGalleries);
router.post('/galleries', requireAuth, uploadAttachment.single('file'), createGallery);
router.delete('/galleries/:id', requireAuth, deleteGallery);

router.get('/structure', getPublicStructure);

// Rute Konten (Berita, Program)
router.get('/', getContents); 
router.get('/:id', getContentById); // <-- RUTE BARU UNTUK BACA KONTEN
router.post('/', requireAuth, uploadAttachment.single('file'), createContent); 
router.delete('/:id', requireAuth, deleteContent); 

export default router;