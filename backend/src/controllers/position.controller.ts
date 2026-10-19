import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';

// 1. Membuat Slot Jabatan (Contoh: "Menteri Kominfo")
export const createPositionSlot = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // [PERBAIKAN KEAMANAN] Hanya ADMIN/SUPERADMIN yang boleh membuat slot jabatan.
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const { organizationId, departmentId, title } = req.body;

    if (!organizationId || !title) {
      res.status(400).json({ message: 'ID Organisasi dan Nama Jabatan wajib diisi.' });
      return;
    }

    const newSlot = await prisma.positionSlot.create({
      data: {
        organizationId,
        departmentId: departmentId || null, // Optional (Bisa jabatan di tingkat organisasi atau tingkat departemen)
        title
      }
    });

    res.status(201).json({ message: 'Jabatan berhasil dibuat.', data: newSlot });
  } catch (error) {
    next(error);
  }
};

// 2. Mengangkat Mahasiswa ke dalam Jabatan
export const assignPosition = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // [PERBAIKAN KEAMANAN] Hanya ADMIN/SUPERADMIN yang boleh mengangkat pengurus.
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const { positionSlotId, nim } = req.body;

    if (!positionSlotId || !nim) {
      res.status(400).json({ message: 'ID Jabatan dan NIM wajib diisi.' });
      return;
    }

    // Cari user berdasarkan NIM
    const user = await prisma.user.findUnique({ where: { nim } });
    if (!user) {
      res.status(404).json({ message: 'Mahasiswa dengan NIM tersebut tidak ditemukan.' });
      return;
    }

    // Masukkan user ke jabatan tersebut
    const position = await prisma.position.create({
      data: {
        positionSlotId,
        userId: user.id
      }
    });

    // Jika dia masih MAHASISWA biasa, naikkan pangkatnya menjadi PENGURUS
    if (user.role === 'MAHASISWA') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'PENGURUS' }
      });
    }

    res.status(201).json({ 
      message: 'Mahasiswa berhasil diangkat menjadi Pengurus.', 
      data: position 
    });
  } catch (error) {
    next(error);
  }
};

// 3. Mengambil Daftar Jabatan beserta siapa yang menjabat
export const getPositions = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.query;

    const positions = await prisma.positionSlot.findMany({
      where: organizationId ? { organizationId: String(organizationId) } : {},
      include: {
        department: true,
        positions: {
          where: { isActive: true },
          include: {
            user: {
              include: { profile: true } // Ambil nama asli mahasiswa
            }
          }
        }
      }
    });

    res.status(200).json({ data: positions });
  } catch (error) {
    next(error);
  }
};

// 4. Menurunkan Pengurus dari Jabatan (Nonaktifkan Position)
export const removePosition = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ message: 'ID Position wajib diisi.' });
      return;
    }

    // Cari position yang akan diturunkan
    const position = await prisma.position.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, positionSlot: true }
    });

    if (!position) {
      res.status(404).json({ message: 'Jabatan tidak ditemukan.' });
      return;
    }

    // Hanya ADMIN/SUPERADMIN yang bisa menurunkan pengurus
    if (!isAdminRole(req.user.role)) {
      res.status(403).json({ message: 'Hanya ADMIN yang bisa menurunkan pengurus.' });
      return;
    }

    // Nonaktifkan position
    await prisma.position.update({
      where: { id },
      data: { isActive: false, endDate: new Date() }
    });

    // Jika user tersebut tidak punya position aktif lain, turunkan role kembali ke MAHASISWA
    const otherActivePositions = await prisma.position.findFirst({
      where: { userId: position.userId, isActive: true }
    });

    if (!otherActivePositions && !isAdminRole(position.user.role)) {
      await prisma.user.update({
        where: { id: position.userId },
        data: { role: 'MAHASISWA' }
      });
    }

    res.status(200).json({
      message: `Pengurus ${position.user.profile?.nama || position.user.nim} berhasil diturunkan dari jabatan ${position.positionSlot.title}.`
    });
  } catch (error) {
    next(error);
  }
};