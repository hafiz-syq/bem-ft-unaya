"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const device_controller_1 = require("../controllers/device.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ticket_access_1 = require("../lib/ticket-access");
const router = (0, express_1.Router)();
// Hanya ADMIN & SUPERADMIN. Aturan tambahan (admin biasa tidak boleh mengelola
// akun ADMIN/SUPERADMIN lain) dijaga di controller.
router.use(auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(ticket_access_1.ADMIN_ROLES));
router.get('/', device_controller_1.getPerangkat);
router.post('/:id/reset', device_controller_1.kelolaPerangkat);
exports.default = router;
