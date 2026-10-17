"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const ticket_routes_1 = __importDefault(require("./routes/ticket.routes"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const organization_routes_1 = __importDefault(require("./routes/organization.routes"));
const position_routes_1 = __importDefault(require("./routes/position.routes"));
const data_request_routes_1 = __importDefault(require("./routes/data-request.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const public_comment_routes_1 = __importDefault(require("./routes/public-comment.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const cms_routes_1 = __importDefault(require("./routes/cms.routes"));
const demisioner_routes_1 = __importDefault(require("./routes/demisioner.routes"));
const faq_routes_1 = __importDefault(require("./routes/faq.routes"));
const student_exports_routes_1 = __importDefault(require("./routes/student-exports.routes"));
const notifikasi_perpanjangan_routes_1 = __importDefault(require("./routes/notifikasi-perpanjangan.routes"));
const upload_middleware_1 = require("./middlewares/upload.middleware");
const cors_origin_1 = require("./lib/cors-origin");
const cors_monitor_service_1 = require("./services/cors-monitor.service");
const app = (0, express_1.default)();
// Konfigurasi CORS.
// Origin yang diizinkan = alamat lokal/LAN yang sah + daftar eksplisit dari env
// (lihat src/lib/cors-origin.ts). Origin publik lain ditolak tanpa header
// Access-Control-Allow-Origin, sehingga browser memblokir permintaannya.
//
// Bentuk delegasi (req, callback) dipakai supaya penolakan bisa dicatat bersama
// asal permintaannya (IP, path, user-agent) untuk ditinjau admin.
app.use((0, cors_1.default)((req, callback) => {
    callback(null, {
        origin: (origin, cb) => {
            const boleh = (0, cors_origin_1.bolehkanOrigin)(origin);
            if (!boleh) {
                // Ditampung di memori dulu, ditulis ke audit log secara berkala
                // (lihat services/cors-monitor.service.ts).
                (0, cors_monitor_service_1.catatPenolakanCors)(origin, req);
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(`[CORS] Origin ditolak: ${origin}`);
                }
            }
            // cb(false) = jangan kirim header CORS untuk origin ini.
            cb(null, boleh);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    });
}));
// Middleware bawaan
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Pendaftaran Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/profile', profile_routes_1.default);
// Ekspor CSV didaftarkan lebih dulu supaya GET /api/students/export tidak
// ditangkap oleh rute berparameter di studentRoutes.
app.use('/api/students', student_exports_routes_1.default);
app.use('/api/students', student_routes_1.default);
app.use('/api/notifikasi-perpanjangan', notifikasi_perpanjangan_routes_1.default);
app.use('/api/notifikasi-perpanjangan', notifikasi_perpanjangan_routes_1.default);
app.use('/api/tickets', ticket_routes_1.default);
app.use('/api/organizations', organization_routes_1.default);
app.use('/api/positions', position_routes_1.default);
app.use('/api/data-requests', data_request_routes_1.default);
app.use('/api/audit', audit_routes_1.default);
app.use('/api/public-comments', public_comment_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/cms', cms_routes_1.default);
app.use('/api/demisioner', demisioner_routes_1.default);
app.use('/api/faqs', faq_routes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'BEM-FT UNAYA API is running smoothly.' });
});
// Global error handler
app.use((err, req, res, next) => {
    // 1. Error bawaan multer (batas ukuran, field tak dikenal) = kesalahan input pengguna
    if (err?.name === 'MulterError') {
        // MulterError tidak membawa nilai limit, jadi batasnya dibaca dari konfigurasi unggahan
        const batas = upload_middleware_1.UPLOAD_LIMITS[err.field];
        const pesanMulter = {
            LIMIT_FILE_SIZE: batas
                ? `Ukuran file terlalu besar. Maksimal ${Math.round(batas / 1024 / 1024)} MB.`
                : 'Ukuran file melebihi batas yang diizinkan.',
            LIMIT_UNEXPECTED_FILE: 'Field unggahan tidak dikenali.',
            LIMIT_FILE_COUNT: 'Jumlah file yang diunggah terlalu banyak.',
        };
        res.status(400).json({ message: pesanMulter[err.code] || 'Unggahan tidak valid.' });
        return;
    }
    // 2. Error validasi dari fileFilter (mis. format foto tidak didukung)
    if (err?.statusCode === 400) {
        res.status(400).json({ message: err.message });
        return;
    }
    // 3. Sisanya benar-benar kegagalan tak terduga
    console.error(err.stack);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
});
exports.default = app;
