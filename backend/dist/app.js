"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
const dashboard_charts_routes_1 = __importDefault(require("./routes/dashboard-charts.routes"));
const student_exports_routes_1 = __importDefault(require("./routes/student-exports.routes"));
const notifikasi_perpanjangan_routes_1 = __importDefault(require("./routes/notifikasi-perpanjangan.routes"));
const device_routes_1 = __importDefault(require("./routes/device.routes"));
const image_convert_routes_1 = __importDefault(require("./routes/image-convert.routes"));
const internal_routes_1 = __importDefault(require("./routes/internal.routes"));
const upload_middleware_1 = require("./middlewares/upload.middleware");
const cors_origin_1 = require("./lib/cors-origin");
const uploads_1 = require("./lib/uploads");
const cors_monitor_service_1 = require("./services/cors-monitor.service");
const app = (0, express_1.default)();
// Ketika API berjalan di balik reverse proxy/load balancer (nginx, Cloudflare,
// cPanel, dsb.), IP asli pengunjung dikirim lewat header X-Forwarded-For.
// Aktifkan dengan TRUST_PROXY=1 agar rate limit komentar tamu dan info asal
// pengirim di halaman moderasi memakai IP pengunjung, bukan IP proxy.
if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}
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
// Folder berkas unggahan mengikuti UPLOAD_DIR (lihat src/lib/uploads.ts) agar
// bisa diarahkan ke volume persisten di server produksi.
app.use('/uploads', express_1.default.static((0, uploads_1.folderUploads)()));
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
app.use('/api/dashboard', dashboard_charts_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/cms', cms_routes_1.default);
app.use('/api/demisioner', demisioner_routes_1.default);
app.use('/api/faqs', faq_routes_1.default);
app.use('/api/devices', device_routes_1.default);
app.use('/api/image-convert', image_convert_routes_1.default);
// Endpoint untuk cron hPanel (siklus akun & notifikasi) — lihat routes/internal.routes.ts.
app.use('/api/internal', internal_routes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'BEM-FT UNAYA API is running smoothly.' });
});
// Semua rute /api yang tidak dikenal tetap dibalas JSON, bukan index.html SPA.
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Endpoint API tidak ditemukan.' });
});
// --- Frontend SPA (deploy satu domain di Hostinger) ---------------------
// Bila SERVE_FRONTEND=1 (atau NODE_ENV=production), backend ikut menyajikan
// hasil build Vite. Satu origin membuat cookie sesi tetap SameSite=Lax dan
// menghilangkan kebutuhan CORS silang situs.
const folderFrontend = path_1.default.resolve(process.env.FRONTEND_DIST || path_1.default.join(__dirname, '../../frontend/dist'));
const berkasIndex = path_1.default.join(folderFrontend, 'index.html');
const sajikanFrontend = process.env.SERVE_FRONTEND === '1' ||
    (process.env.SERVE_FRONTEND !== '0' && process.env.NODE_ENV === 'production');
if (sajikanFrontend) {
    if (fs_1.default.existsSync(berkasIndex)) {
        app.use(express_1.default.static(folderFrontend, {
            index: false,
            maxAge: '1h',
            setHeaders: (res, filePath) => {
                // index.html harus selalu dicek ulang agar deploy baru langsung terpakai.
                if (filePath.endsWith('index.html')) {
                    res.setHeader('Cache-Control', 'no-cache');
                }
                else if (filePath.includes(`${path_1.default.sep}assets${path_1.default.sep}`)) {
                    // Nama berkas di /assets memuat hash, jadi aman di-cache lama.
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
            },
        }));
        // Fallback rute SPA (mis. /login, /agenda). Berkas yang punya ekstensi
        // (aset yang benar-benar hilang) dibiarkan 404, bukan dibalas HTML.
        app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (req, res, next) => {
            // Jangan balas HTML untuk aset yang hilang atau berkas titik (mis. /.env).
            if (path_1.default.extname(req.path) || path_1.default.basename(req.path).startsWith('.'))
                return next();
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(berkasIndex);
        });
    }
    else {
        console.warn(`[frontend] SERVE_FRONTEND aktif, tetapi ${berkasIndex} tidak ada. ` +
            'Jalankan build frontend atau setel FRONTEND_DIST ke folder hasil build.');
    }
}
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
