"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_exports_controller_1 = require("../controllers/student-exports.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Hanya admin yang bisa mengekspor data mahasiswa
router.get('/export', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), student_exports_controller_1.exportMahasiswa);
exports.default = router;
