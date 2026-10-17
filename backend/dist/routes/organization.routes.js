"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organization_controller_1 = require("../controllers/organization.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Master organisasi adalah area admin (lihat menu "Master Organisasi").
router.use(auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN']));
router.get('/', organization_controller_1.getOrganizations);
router.post('/', organization_controller_1.createOrganization);
router.post('/departments', organization_controller_1.createDepartment);
router.delete('/departments/:id', organization_controller_1.deleteDepartment);
// Hapus organisasi beserta divisi & slot jabatannya (butuh force=true bila masih
// menyimpan riwayat jabatan lama).
router.delete('/:id', organization_controller_1.deleteOrganization);
exports.default = router;
