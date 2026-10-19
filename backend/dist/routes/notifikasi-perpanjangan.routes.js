"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifikasi_perpanjangan_service_1 = require("../services/notifikasi-perpanjangan.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const auth_middleware_2 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Endpoint khusus admin untuk menjalankan pemeriksaan notifikasi perpanjangan
router.post('/check', auth_middleware_1.requireAuth, (0, auth_middleware_2.requireRole)(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const result = await (0, notifikasi_perpanjangan_service_1.pemeriksaanPerpanjanganHarian)();
        res.status(200).json({
            message: 'Pemeriksaan notifikasi perpanjangan selesai.',
            data: result,
        });
    }
    catch (error) {
        console.error('Gagal pemeriksaan notifikasi perpanjangan:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat pemeriksaan.' });
    }
});
exports.default = router;
