import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request { user?: any; }

export const requireAuth = (req: any, res: Response, next: NextFunction): void => {
  try {
    // Membaca token dari httpOnly cookie
    const token = req.cookies.token;
    
    if (!token) {
      res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
      return;
    }

    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded; // Menyimpan data user ke request
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden.' }); return;
    }
    next();
  };
};