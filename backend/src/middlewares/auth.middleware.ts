import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';
import { periksaSesiPerangkat } from '../lib/device';

export interface AuthRequest extends Request { user?: any; }

export const requireAuth = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Membaca token dari httpOnly cookie
    const token = req.cookies.token;

    if (!token) {
      res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
      return;
    }

    // Verifikasi token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    // Status akun diperiksa ulang ke database, tidak cukup dari isi token.
    // Alasannya: token berlaku 1 hari, sehingga tanpa pemeriksaan ini akun yang
    // dinonaktifkan (mis. habis masa studi) atau yang sudah dihapus masih bisa
    // memakai sesi lamanya, dan perubahan role baru berlaku setelah login ulang.
    const akun = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, nim: true, role: true, isActive: true,
        deviceId: true, sessionVersion: true,
      },
    });

    if (!akun) {
      res.status(401).json({ message: 'Akun tidak ditemukan. Silakan login kembali.' });
      return;
    }

    if (!akun.isActive) {
      // Akun pengelola tidak pernah ditolak: statusnya dipulihkan saat itu juga.
      // Ini penjagaan terakhir supaya kesalahan status pada ADMIN/SUPERADMIN
      // tidak bisa mengunci seluruh sistem.
      if (isAdminRole(akun.role)) {
        await prisma.user.update({
          where: { id: akun.id },
          data: { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null },
        });
      } else {
        res.status(403).json({
          message: 'Akun ini sudah dinonaktifkan. Silakan hubungi administrator.',
        });
        return;
      }
    }

    // Perangkat diperiksa setiap permintaan supaya membuka kunci perangkat
    // langsung memutus sesi lama, tanpa menunggu token kedaluwarsa (1 hari).
    const alasanPerangkat = periksaSesiPerangkat(akun, decoded);
    if (alasanPerangkat) {
      res.status(401).json({ code: 'PERANGKAT_BERUBAH', message: alasanPerangkat });
      return;
    }

    // Role diambil dari database agar keputusan otorisasi selalu mengikuti keadaan
    // terkini, bukan role saat token dibuat.
    req.user = { ...decoded, id: akun.id, nim: akun.nim, role: akun.role };

    next();
  } catch (error) {
    res.status(401).json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }
};

/**
 * Seperti requireAuth, tetapi tamu tetap dilanjutkan tanpa `req.user`.
 *
 * Dipakai pada endpoint publik yang ingin mengenali pengguna login bila ada,
 * mis. komentar galeri: tamu boleh menulis dengan nama sendiri, sedangkan
 * pengguna login otomatis memakai identitas akunnya. Token yang tidak valid
 * diperlakukan sebagai tamu, bukan 401, supaya sesi kedaluwarsa tidak
 * menghalangi pengunjung biasa.
 */
export const optionalAuth = async (req: any, _res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies?.token;
  if (!token) { next(); return; }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const akun = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, nim: true, role: true, isActive: true,
        deviceId: true, sessionVersion: true,
      },
    });

    // Sesi dari perangkat lama diperlakukan seperti tamu, bukan 401: endpoint
    // pemakai optionalAuth tetap bisa dibaca publik tanpa menjatuhkan halaman.
    if (akun?.isActive && !periksaSesiPerangkat(akun, decoded)) {
      req.user = { ...decoded, id: akun.id, nim: akun.nim, role: akun.role };
    }
  } catch {
    // Token tidak valid/kedaluwarsa: lanjut sebagai tamu.
  }

  next();
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden.' }); return;
    }
    next();
  };
};