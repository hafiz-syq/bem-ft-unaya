"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cms_controller_1 = require("../controllers/cms.controller");
const gallery_comment_controller_1 = require("../controllers/gallery-comment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const ticket_access_1 = require("../lib/ticket-access");
const router = (0, express_1.Router)();
// Pengelola konten publik = admin + seluruh jenis pengurus.
const pengelola = [auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN', ...ticket_access_1.OFFICER_ROLES])];
// Unggahan galeri boleh memuat banyak foto sekaligus (maksimal 10) dalam satu postingan.
const unggahGaleri = upload_middleware_1.uploadAttachment.fields([
    { name: 'images', maxCount: 10 },
    { name: 'file', maxCount: 1 },
]);
// Unggahan cover konten/berita tetap satu file.
const unggahKonten = upload_middleware_1.uploadAttachment.fields([
    { name: 'file', maxCount: 1 },
    { name: 'images', maxCount: 1 },
]);
// --- Pengaturan situs (visi & misi dapat diubah tiap pergantian kepengurusan) ---
// Hanya ADMIN yang boleh mengubah teks resmi organisasi.
router.get('/settings', cms_controller_1.getSiteSettings);
router.put('/settings', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), cms_controller_1.updateSiteSettings);
// --- Struktur kepengurusan (publik, tanpa email) ---
router.get('/structure', cms_controller_1.getPublicStructure);
// --- Agenda ---
router.get('/agendas', cms_controller_1.getAgendas);
router.post('/agendas', ...pengelola, cms_controller_1.createAgenda);
router.put('/agendas/:id', ...pengelola, cms_controller_1.updateAgenda);
router.delete('/agendas/:id', ...pengelola, cms_controller_1.deleteAgenda);
// --- Galeri (banyak foto per postingan) ---
router.get('/galleries', cms_controller_1.getGalleries);
router.post('/galleries', ...pengelola, unggahGaleri, cms_controller_1.createGallery);
router.put('/galleries/:id', ...pengelola, unggahGaleri, cms_controller_1.updateGallery);
router.delete('/galleries/:id', ...pengelola, cms_controller_1.deleteGallery);
// --- Komentar galeri ---
// Baca komentar tayang: publik. Kirim komentar: semua pengunjung boleh
// (tamu mengisi nama sendiri; pengguna login memakai identitas akunnya), tapi
// tetap masuk antrean tinjauan (PENDING) supaya isi tidak pantas tidak tayang.
router.get('/galleries/:id/comments', gallery_comment_controller_1.getKomentarGaleri);
router.post('/galleries/:id/comments', auth_middleware_1.optionalAuth, gallery_comment_controller_1.kirimKomentarGaleri);
// Antrean moderasi komentar galeri (admin & pengurus). Didaftarkan sebelum rute
// konten `/:id` di bawah agar tidak tertutup rute berparameter tersebut.
router.get('/gallery-comments', ...pengelola, gallery_comment_controller_1.getKomentarGaleriUntukModerasi);
router.patch('/gallery-comments/:id/status', ...pengelola, gallery_comment_controller_1.ubahStatusKomentarGaleri);
router.delete('/gallery-comments/:id', ...pengelola, gallery_comment_controller_1.hapusKomentarGaleri);
// --- Konten (Berita, Artikel, Program Kerja) ---
router.get('/', cms_controller_1.getContents);
router.post('/', ...pengelola, unggahKonten, cms_controller_1.createContent);
router.get('/:id', cms_controller_1.getContentById);
router.put('/:id', ...pengelola, unggahKonten, cms_controller_1.updateContent);
router.delete('/:id', ...pengelola, cms_controller_1.deleteContent);
exports.default = router;
