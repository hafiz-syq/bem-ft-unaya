"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const image_convert_controller_1 = require("../controllers/image-convert.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ticket_access_1 = require("../lib/ticket-access");
const router = (0, express_1.Router)();
// Pengelola gambar = admin + seluruh jenis pengurus (sama dengan cms.routes).
const pengelola = [auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN', ...ticket_access_1.OFFICER_ROLES])];
router.post('/konversi', ...pengelola, image_convert_controller_1.konversiGambarDariUrl);
router.get('/preview', ...pengelola, image_convert_controller_1.previewKonversiGambar);
router.post('/validasi-url', ...pengelola, image_convert_controller_1.validasiUrlGambar);
exports.default = router;
