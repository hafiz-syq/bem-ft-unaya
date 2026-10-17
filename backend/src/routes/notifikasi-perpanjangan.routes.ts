import { Router } from 'express';
import { pemeriksaanPerpanjanganHarian } from '../services/notifikasi-perpanjangan.service';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint khusus admin untuk menjalankan pemeriksaan notifikasi perpanjangan
router.post('/check', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const result = await pemeriksaanPerpanjanganHarian();
    res.status(200).json({
      message: 'Pemeriksaan notifikasi perpanjangan selesai.',
      data: result,
    });
  } catch (error) {
    console.error('Gagal pemeriksaan notifikasi perpanjangan:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat pemeriksaan.' });
  }
});

export default router;
