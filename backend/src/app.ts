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
import { UPLOAD_LIMITS } from './middlewares/upload.middleware';

const app: Application = express();

// Konfigurasi CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Middleware bawaan
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Pendaftaran Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/data-requests', dataRequestRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/public-comments', publicCommentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cms', cmsRoutes);

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