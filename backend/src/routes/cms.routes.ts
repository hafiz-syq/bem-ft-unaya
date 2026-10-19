import { Router } from 'express';
import {
  getContents, createContent, updateContent, deleteContent, getContentById,
  getAgendas, createAgenda, updateAgenda, deleteAgenda,
  getGalleries, createGallery, updateGallery, deleteGallery,
  getSiteSettings, updateSiteSettings,
  getPublicStructure,
} from '../controllers/cms.controller';
import {
  getKomentarGaleri,
  kirimKomentarGaleri,
  getKomentarGaleriUntukModerasi,
  ubahStatusKomentarGaleri,
  hapusKomentarGaleri,
} from '../controllers/gallery-comment.controller';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.middleware';
import { uploadAttachment } from '../middlewares/upload.middleware';
import { OFFICER_ROLES } from '../lib/ticket-access';

const router = Router();

// Pengelola konten publik = admin + seluruh jenis pengurus.
const pengelola = [requireAuth, requireRole(['ADMIN', 'SUPERADMIN', ...OFFICER_ROLES])];

// Unggahan galeri boleh memuat banyak foto sekaligus (maksimal 10) dalam satu postingan.
const unggahGaleri = uploadAttachment.fields([
  { name: 'images', maxCount: 10 },
  { name: 'file', maxCount: 1 },
]);

// Unggahan cover konten/berita tetap satu file.
const unggahKonten = uploadAttachment.fields([
  { name: 'file', maxCount: 1 },
  { name: 'images', maxCount: 1 },
]);

// --- Pengaturan situs (visi & misi dapat diubah tiap pergantian kepengurusan) ---
// Hanya ADMIN yang boleh mengubah teks resmi organisasi.
router.get('/settings', getSiteSettings);
router.put('/settings', requireAuth, requireRole(['ADMIN', 'SUPERADMIN']), updateSiteSettings);

// --- Struktur kepengurusan (publik, tanpa email) ---
router.get('/structure', getPublicStructure);

// --- Agenda ---
router.get('/agendas', getAgendas);
router.post('/agendas', ...pengelola, createAgenda);
router.put('/agendas/:id', ...pengelola, updateAgenda);
router.delete('/agendas/:id', ...pengelola, deleteAgenda);

// --- Galeri (banyak foto per postingan) ---
router.get('/galleries', getGalleries);
router.post('/galleries', ...pengelola, unggahGaleri, createGallery);
router.put('/galleries/:id', ...pengelola, unggahGaleri, updateGallery);
router.delete('/galleries/:id', ...pengelola, deleteGallery);

// --- Komentar galeri ---
// Baca komentar tayang: publik. Kirim komentar: semua pengunjung boleh
// (tamu mengisi nama sendiri; pengguna login memakai identitas akunnya), tapi
// tetap masuk antrean tinjauan (PENDING) supaya isi tidak pantas tidak tayang.
router.get('/galleries/:id/comments', getKomentarGaleri);
router.post('/galleries/:id/comments', optionalAuth, kirimKomentarGaleri);

// Antrean moderasi komentar galeri (admin & pengurus). Didaftarkan sebelum rute
// konten `/:id` di bawah agar tidak tertutup rute berparameter tersebut.
router.get('/gallery-comments', ...pengelola, getKomentarGaleriUntukModerasi);
router.patch('/gallery-comments/:id/status', ...pengelola, ubahStatusKomentarGaleri);
router.delete('/gallery-comments/:id', ...pengelola, hapusKomentarGaleri);

// --- Konten (Berita, Artikel, Program Kerja) ---
router.get('/', getContents);
router.post('/', ...pengelola, unggahKonten, createContent);
router.get('/:id', getContentById);
router.put('/:id', ...pengelola, unggahKonten, updateContent);
router.delete('/:id', ...pengelola, deleteContent);

export default router;
