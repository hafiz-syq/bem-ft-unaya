"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const faq_controller_1 = require("../controllers/faq.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Semua pengguna yang login boleh membaca FAQ (halaman ada di DashboardLayout).
router.get('/', auth_middleware_1.requireAuth, faq_controller_1.getFaqs);
// Pengelolaan FAQ khusus admin.
router.post('/', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN']), faq_controller_1.createFaq);
router.put('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN']), faq_controller_1.updateFaq);
router.delete('/:id', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN']), faq_controller_1.deleteFaq);
exports.default = router;
