"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_controller_1 = require("../controllers/audit.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Hanya admin yang bisa melihat log aktivitas
router.get('/', auth_middleware_1.requireAuth, audit_controller_1.getAuditLogs);
exports.default = router;
