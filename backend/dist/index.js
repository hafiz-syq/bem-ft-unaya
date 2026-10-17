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
const app_1 = __importDefault(require("./app"));
const account_lifecycle_service_1 = require("./services/account-lifecycle.service");
const cors_monitor_service_1 = require("./services/cors-monitor.service");
const PORT = process.env.PORT || 3000;
app_1.default.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 BEM-FT UNAYA API Server Started`);
    console.log(`🌐 URL   : http://localhost:${PORT}`);
    console.log(`🔧 ENV   : ${process.env.NODE_ENV}`);
    console.log(`========================================\n`);
});
// Menjalankan pemeriksaan siklus hidup akun (nonaktif otomatis 5 tahun &
// hapus otomatis setelah nonaktif 1 tahun) tanpa perlu cron eksternal.
(0, account_lifecycle_service_1.startAccountLifecycleJob)();
// Menuliskan penolakan origin yang tertampung di memori ke audit log secara
// berkala, supaya admin bisa meninjau polanya dari dashboard.
(0, cors_monitor_service_1.startPemantauanCors)();
Promise.resolve().then(() => __importStar(require('./services/notifikasi-perpanjangan.service'))).then(async ({ pemeriksaanPerpanjanganHarian }) => {
    const result = await pemeriksaanPerpanjanganHarian();
    console.log(`[notifikasi-perpanjangan] Pemeriksaan awal: ${result['30_hari']} akun dengan 30 hari lagi, ${result['7_hari']} akun dengan 7 hari lagi.`);
})
    .catch((error) => {
    console.error('[notifikasi-perpanjangan] Gagal pemeriksaan awal:', error);
});
