import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
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
import { UPLOAD_LIMITS } from './middlewares/upload.middleware';
import { bolehkanOrigin } from './lib/cors-origin';
import { catatPenolakanCors } from './services/cors-monitor.service';

const app: Application = express();

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'BEM-FT UNAYA API is running smoothly.' });
});

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