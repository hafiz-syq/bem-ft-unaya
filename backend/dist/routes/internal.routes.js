"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const account_lifecycle_service_1 = require("../services/account-lifecycle.service");
const notifikasi_perpanjangan_service_1 = require("../services/notifikasi-perpanjangan.service");
const cors_monitor_service_1 = require("../services/cors-monitor.service");
/**
 * Endpoint untuk cron Hostinger.
 *
 * Di shared hosting, proses Node bisa dihentikan saat tidak ada trafik
 * (on-demand). Timer `setInterval` di index.ts karenanya tidak bisa diandalkan
 * untuk job harian. Cron hPanel memanggil endpoint ini secara berkala, dan
 * `RUN_STARTUP_JOBS=0` mematikan job saat cold start supaya email peringatan
 * tidak terkirim berkali-kali setiap aplikasi dibangunkan.
 *
 * Endpoint ini tidak dapat dipakai tanpa CRON_SECRET. Bila CRON_SECRET kosong,
 * semua permintaan tetap ditolak 401 supaya tidak menjadi pintu terbuka dan
 * perilakunya sama di semua lingkungan (termasuk CI yang tidak punya secret).
 */
const router = (0, express_1.Router)();
const secretSama = (diberikan, diharapkan) => {
    if (!diberikan)
        return false;
    const a = Buffer.from(diberikan);
    const b = Buffer.from(diharapkan);
    return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
};
router.post('/cron', async (req, res) => {
    const secret = (process.env.CRON_SECRET || '').trim();
    if (!secret || !secretSama(req.get('x-cron-secret'), secret)) {
        res.status(401).json({ message: 'Kunci cron tidak sah.' });
        return;
    }
    let gagal = false;
    let siklusAkun = null;
    try {
        const hasil = await (0, account_lifecycle_service_1.runAccountLifecycleJob)();
        siklusAkun = {
            dinonaktifkan: hasil.dinonaktifkan,
            dihapus: hasil.dihapus,
            dipulihkan: hasil.dipulihkan,
            gagal: hasil.gagal.length,
        };
    }
    catch (error) {
        gagal = true;
        console.error('[cron] Siklus akun gagal:', error);
    }
    let perpanjangan = null;
    try {
        perpanjangan = await (0, notifikasi_perpanjangan_service_1.pemeriksaanPerpanjanganHarian)();
    }
    catch (error) {
        gagal = true;
        console.error('[cron] Notifikasi perpanjangan gagal:', error);
    }
    let corsTertulis = 0;
    try {
        corsTertulis = await (0, cors_monitor_service_1.flushPenolakanCors)();
    }
    catch (error) {
        gagal = true;
        console.error('[cron] Penulisan catatan CORS gagal:', error);
    }
    // Balasan sengaja hanya berisi angka agregat: tidak ada NIM, email, atau
    // detail akun yang keluar lewat endpoint ini.
    res.status(gagal ? 500 : 200).json({
        ok: !gagal,
        siklusAkun,
        perpanjangan,
        corsTertulis,
        dijalankanPada: new Date().toISOString(),
    });
});
exports.default = router;
