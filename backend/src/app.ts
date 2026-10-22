import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import ticketRoutes from './routes/ticket.routes';
import studentRoutes from './routes/student.routes';
import organizationRoutes from './routes/organization.routes';
import positionRoutes from './routes/position.routes';
import dataRequestRoutes from './routes/data-request.routes';
import auditRoutes from './routes/audit.routes';
import publicCommentRoutes from './routes/public-comment.routes';
import dashboardRoutes from './routes/dashboard.routes';
import notificationRoutes from './routes/notification.routes';
import cmsRoutes from './routes/cms.routes';
import demisionerRoutes from './routes/demisioner.routes';
import faqRoutes from './routes/faq.routes';
import dashboardChartsRoutes from './routes/dashboard-charts.routes';
import studentExportsRoutes from './routes/student-exports.routes';
import notifikasiPerpanjanganRoutes from './routes/notifikasi-perpanjangan.routes';
import deviceRoutes from './routes/device.routes';
import imageConvertRoutes from './routes/image-convert.routes';
import internalRoutes from './routes/internal.routes';
import { UPLOAD_LIMITS } from './middlewares/upload.middleware';
import { bolehkanOrigin } from './lib/cors-origin';
import { folderUploads } from './lib/uploads';
import { catatPenolakanCors } from './services/cors-monitor.service';

const app: Application = express();

// Ketika API berjalan di balik reverse proxy/load balancer (nginx, Cloudflare,
// cPanel, Vercel, dsb.), IP asli pengunjung dikirim lewat header X-Forwarded-For.
// Aktifkan dengan TRUST_PROXY=1 agar rate limit komentar tamu dan info asal
// pengirim di halaman moderasi memakai IP pengunjung, bukan IP proxy.
//
// Vercel selalu menambahkan X-Forwarded-For. Tanpa trust proxy, express-rate-limit
// mencatat validation error dan membatasi semua pengunjung sebagai satu IP.
const diBalikProxy =
  process.env.TRUST_PROXY === '1' ||
  process.env.VERCEL === '1' ||
  Boolean(process.env.VERCEL_ENV);

if (diBalikProxy) {
  app.set('trust proxy', 1);
}

// Konfigurasi CORS.
// Origin yang diizinkan = alamat lokal/LAN yang sah + daftar eksplisit dari env
// (lihat src/lib/cors-origin.ts). Origin publik lain ditolak tanpa header
// Access-Control-Allow-Origin, sehingga browser memblokir permintaannya.
//
// Bentuk delegasi (req, callback) dipakai supaya penolakan bisa dicatat bersama
// asal permintaannya (IP, path, user-agent) untuk ditinjau admin.
app.use(
  cors((req, callback) => {
    callback(null, {
      origin: (origin, cb) => {
        const boleh = bolehkanOrigin(origin);

        if (!boleh) {
          // Ditampung di memori dulu, ditulis ke audit log secara berkala
          // (lihat services/cors-monitor.service.ts).
          catatPenolakanCors(origin, req);

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
  })
);

// Middleware bawaan
app.use(express.json());
app.use(cookieParser());

// Folder berkas unggahan mengikuti UPLOAD_DIR (lihat src/lib/uploads.ts) agar
// bisa diarahkan ke volume persisten di server produksi.
app.use('/uploads', express.static(folderUploads()));

// Pendaftaran Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
// Ekspor CSV didaftarkan lebih dulu supaya GET /api/students/export tidak
// ditangkap oleh rute berparameter di studentRoutes.
app.use('/api/students', studentExportsRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/notifikasi-perpanjangan', notifikasiPerpanjanganRoutes);
app.use('/api/notifikasi-perpanjangan', notifikasiPerpanjanganRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/data-requests', dataRequestRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/public-comments', publicCommentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard', dashboardChartsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/demisioner', demisionerRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/image-convert', imageConvertRoutes);
// Endpoint untuk cron hPanel (siklus akun & notifikasi) — lihat routes/internal.routes.ts.
app.use('/api/internal', internalRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'BEM-FT UNAYA API is running smoothly.' });
});

// Semua rute /api yang tidak dikenal tetap dibalas JSON, bukan index.html SPA.
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ message: 'Endpoint API tidak ditemukan.' });
});

// --- Frontend SPA (deploy satu domain di Hostinger) ---------------------
// Bila SERVE_FRONTEND=1 (atau NODE_ENV=production), backend ikut menyajikan
// hasil build Vite. Satu origin membuat cookie sesi tetap SameSite=Lax dan
// menghilangkan kebutuhan CORS silang situs.
const folderFrontend = path.resolve(
  process.env.FRONTEND_DIST || path.join(__dirname, '../../frontend/dist')
);
const berkasIndex = path.join(folderFrontend, 'index.html');
const sajikanFrontend =
  process.env.SERVE_FRONTEND === '1' ||
  (process.env.SERVE_FRONTEND !== '0' && process.env.NODE_ENV === 'production');

if (sajikanFrontend) {
  if (fs.existsSync(berkasIndex)) {
    app.use(
      express.static(folderFrontend, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          // index.html harus selalu dicek ulang agar deploy baru langsung terpakai.
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Nama berkas di /assets memuat hash, jadi aman di-cache lama.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    // Fallback rute SPA (mis. /login, /agenda). Berkas yang punya ekstensi
    // (aset yang benar-benar hilang) dibiarkan 404, bukan dibalas HTML.
    app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (req: Request, res: Response, next: NextFunction) => {
      // Jangan balas HTML untuk aset yang hilang atau berkas titik (mis. /.env).
      if (path.extname(req.path) || path.basename(req.path).startsWith('.')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(berkasIndex);
    });
  } else {
    console.warn(
      `[frontend] SERVE_FRONTEND aktif, tetapi ${berkasIndex} tidak ada. ` +
        'Jalankan build frontend atau setel FRONTEND_DIST ke folder hasil build.'
    );
  }
}

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // 1. Error bawaan multer (batas ukuran, field tak dikenal) = kesalahan input pengguna
  if (err?.name === 'MulterError') {
    // MulterError tidak membawa nilai limit, jadi batasnya dibaca dari konfigurasi unggahan
    const batas = (UPLOAD_LIMITS as Record<string, number>)[err.field];
    const pesanMulter: Record<string, string> = {
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

export default app;