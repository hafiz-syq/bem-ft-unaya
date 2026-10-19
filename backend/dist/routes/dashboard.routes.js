"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const dashboard_statistik_controller_1 = require("../controllers/dashboard-statistik.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/stats', auth_middleware_1.requireAuth, dashboard_controller_1.getDashboardStats);
// Statistik + deret grafik untuk semua role (mahasiswa, pengurus, admin).
router.get('/statistik', auth_middleware_1.requireAuth, dashboard_statistik_controller_1.getDashboardStatistik);
exports.default = router;
