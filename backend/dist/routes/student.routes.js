"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_controller_1 = require("../controllers/student.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const student_import_controller_1 = require("../controllers/student-import.controller");
const router = (0, express_1.Router)();
// Semua rute di sini hanya untuk pengurus & admin.
router.use(auth_middleware_1.requireAuth, student_controller_1.requireOfficer);
// Pemeriksaan siklus hidup akun secara manual (admin saja).
router.post('/maintenance/run-lifecycle', student_controller_1.requireAdmin, student_controller_1.runLifecycle);
// Impor massal dari PDF (admin saja). Dua langkah: pratinjau dulu, baru simpan.
router.post('/import/pratinjau', student_controller_1.requireAdmin, upload_middleware_1.uploadPdfImpor.single('file'), student_import_controller_1.pratinjauImpor);
router.post('/import/simpan', student_controller_1.requireAdmin, upload_middleware_1.uploadPdfImpor.single('file'), student_import_controller_1.simpanImpor);
router.get('/', student_controller_1.getStudents);
router.post('/', student_controller_1.createStudent);
router.patch('/:id/status', student_controller_1.updateStudentStatus);
// Perpanjangan masa studi & geser tenggat hapus: hanya admin, karena menyangkut
// keberadaan akun.
router.patch('/:id/perpanjangan', student_controller_1.requireAdmin, student_controller_1.perpanjangAkun);
router.patch('/:id/role', student_controller_1.requireAdmin, student_controller_1.updateStudentRole);
exports.default = router;
