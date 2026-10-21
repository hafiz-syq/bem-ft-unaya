"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Muat .env lebih dulu supaya PORT, UPLOAD_DIR, COOKIE_SAME_SITE, dan variabel
// lain sudah tersedia saat modul lain dievaluasi.
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const account_lifecycle_service_1 = require("./services/account-lifecycle.service");
const cors_monitor_service_1 = require("./services/cors-monitor.service");
const PORT = process.env.PORT || 3000;
const diVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
// Vercel Function mengimpor app dan menangani request sendiri. Jangan buka
// listener di sana; listener hanya untuk Hostinger/proses Node biasa.
exports.default = app_1.default;
if (!diVercel) {
    app_1.default.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`🚀 BEM-FT UNAYA API Server Started`);
        console.log(`🌐 URL   : http://localhost:${PORT}`);
        console.log(`🔧 ENV   : ${process.env.NODE_ENV}`);
        console.log(`========================================\n`);
    });
}
// Di Hostinger, proses Node bisa berhenti saat tidak ada trafik lalu dinyalakan
// lagi pada permintaan berikutnya. Kalau job dijalankan pada setiap cold start,
// email peringatan bisa terkirim berkali-kali dalam sehari. Karena itu setel
// RUN_STARTUP_JOBS=0 di hPanel dan biarkan cron memanggil /api/internal/cron.
const jalankanJobSaatMulai = !diVercel && process.env.RUN_STARTUP_JOBS !== '0';
if (diVercel) {
    console.log('[job] Vercel Function — job berkala tidak dijalankan saat inisialisasi.');
}
else if (jalankanJobSaatMulai) {
    // Menjalankan pemeriksaan siklus hidup akun (nonaktif otomatis 5 tahun &
    // hapus otomatis setelah nonaktif 1 tahun).
    (0, account_lifecycle_service_1.startAccountLifecycleJob)();
    Promise.resolve().then(() => __importStar(require('./services/notifikasi-perpanjangan.service'))).then(async ({ pemeriksaanPerpanjanganHarian }) => {
        const result = await pemeriksaanPerpanjanganHarian();
        console.log(`[notifikasi-perpanjangan] Pemeriksaan awal: ${result['30_hari']} akun dengan 30 hari lagi, ${result['7_hari']} akun dengan 7 hari lagi.`);
    })
        .catch((error) => {
        console.error('[notifikasi-perpanjangan] Gagal pemeriksaan awal:', error);
        // P2022 = kolom yang dipakai Prisma Client belum ada di database. Hampir
        // selalu berarti migrasi belum dijalankan, dan pesan Prisma tidak
        // menyebutkan langkah perbaikannya. Server tetap berjalan; hanya
        // pemeriksaan awal ini yang terlewat.
        if (error?.code === 'P2022' || error?.code === 'P2021') {
            console.error('[notifikasi-perpanjangan] Skema database tertinggal dari schema.prisma. ' +
                'Jalankan "npx prisma migrate deploy" di folder backend, lalu restart server.');
        }
    });
}
else {
    console.log('[job] RUN_STARTUP_JOBS=0 — job berkala diserahkan ke cron /api/internal/cron.');
}
// Menuliskan penolakan origin yang tertampung di memori ke audit log secara
// berkala, supaya admin bisa meninjau polanya dari dashboard. Di Vercel,
// interval ini tidak dijalankan karena function tidak punya siklus hidup server.
if (!diVercel) {
    (0, cors_monitor_service_1.startPemantauanCors)();
}
