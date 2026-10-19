"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_charts_controller_1 = require("../controllers/dashboard-charts.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ticket_access_1 = require("../lib/ticket-access");
const router = (0, express_1.Router)();
// Hanya admin atau pengurus yang bisa melihat grafik dashboard
router.get('/charts', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN', ...ticket_access_1.OFFICER_ROLES]), dashboard_charts_controller_1.getDashboardCharts);
// Endpoint khusus untuk mendownload CSV laporan impor (bisa dipanggil tanpa auth,
// namun tetap pakai rate-limit internal di app.ts jika perlu)
router.get('/charts/export-impor', auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRole)(['ADMIN', 'SUPERADMIN']), dashboard_charts_controller_1.exportImporCsv);
exports.default = router;
