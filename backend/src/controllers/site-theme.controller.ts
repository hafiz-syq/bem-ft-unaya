import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';

/**
 * Tema musiman situs (Ramadan, Idulfitri, Nusantara).
 *
 * Disimpan sebagai satu baris SiteSetting supaya ikut mekanisme pengaturan yang
 * sudah ada dan tidak perlu migrasi tabel baru. Pilihan tema berlaku untuk
 * SEMUA pengunjung — karena itu hanya SUPERADMIN yang boleh mengubahnya, bukan
 * admin biasa. Membaca tema bersifat publik: halaman depan perlu tahu tema
 * aktif sebelum pengguna login.
 */

export const TEMA_MUSIMAN = ['NONE', 'RAMADAN', 'LEBARAN', 'NUSANTARA'] as const;
export type TemaMusiman = (typeof TEMA_MUSIMAN)[number];

export const KUNCI_TEMA_MUSIMAN = 'tema_musiman';

/** Nilai yang tidak dikenal (atau kosong) selalu jatuh ke tema netral. */
const normalisasiTema = (nilai: unknown): TemaMusiman => {
  const teks = String(nilai ?? '').trim().toUpperCase();
  return (TEMA_MUSIMAN as readonly string[]).includes(teks)
    ? (teks as TemaMusiman)
    : 'NONE';
};

/** GET /api/site-theme — publik, dipakai halaman depan & dashboard. */
export const getTemaMusiman = async (_req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const baris = await prisma.siteSetting.findUnique({
      where: { key: KUNCI_TEMA_MUSIMAN },
      select: { value: true },
    });

    // Cache singkat: tema jarang berubah, tetapi saat superadmin menggantinya
    // semua pengunjung harus melihat versi baru tanpa menunggu lama.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.status(200).json({ data: { tema: normalisasiTema(baris?.value) } });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/site-theme — hanya SUPERADMIN. */
export const updateTemaMusiman = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mentah = String(req.body?.tema ?? '').trim().toUpperCase();

    if (!(TEMA_MUSIMAN as readonly string[]).includes(mentah)) {
      res.status(400).json({
        message: 'Tema tidak dikenali. Pilih NONE, RAMADAN, LEBARAN, atau NUSANTARA.',
      });
      return;
    }

    const tema = mentah as TemaMusiman;

    await prisma.siteSetting.upsert({
      where: { key: KUNCI_TEMA_MUSIMAN },
      create: { key: KUNCI_TEMA_MUSIMAN, value: tema },
      update: { value: tema },
    });

    await logActivity(
      req.user.id,
      'UPDATE_THEME',
      'SiteSetting',
      `Mengubah tema musiman situs menjadi ${tema}`,
      KUNCI_TEMA_MUSIMAN,
      { tema }
    );

    res.status(200).json({
      message: tema === 'NONE' ? 'Tema musiman dinonaktifkan.' : `Tema ${tema} diaktifkan.`,
      data: { tema },
    });
  } catch (error) {
    next(error);
  }
};
