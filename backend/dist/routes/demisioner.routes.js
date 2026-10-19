"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const demisioner_controller_1 = require("../controllers/demisioner.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Publik: landing & halaman riwayat demisioner.
router.get('/', demisioner_controller_1.getDemisioner);
// Admin: mengelola riwayat demisioner.
const unggahFotoDemisioner = (0, upload_middleware_1.denganWebp)(upload_middleware_1.uploadPhoto);
router.post('/', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), unggahFotoDemisioner.single('foto'), demisioner_controller_1.createDemisioner);
router.put('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), unggahFotoDemisioner.single('foto'), demisioner_controller_1.updateDemisioner);
router.delete('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), demisioner_controller_1.deleteDemisioner);
exports.default = router;
