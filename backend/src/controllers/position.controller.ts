import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';
import { logActivity } from '../services/audit.service';

// 1. Membuat Slot Jabatan (Contoh: "Menteri Kominfo")
export const createPositionSlot = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // [PERBAIKAN KEAMANAN] Hanya ADMIN/SUPERADMIN yang boleh membuat slot jabatan.
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const { organizationId, departmentId } = req.body;
    const title = String(req.body?.title ?? '').trim();

    if (!organizationId || !title) {
      res.status(400).json({ message: 'ID Organisasi dan Nama Jabatan wajib diisi.' });
      return;
    }

    const organisasi = await prisma.organization.findUnique({
      where: { id: String(organizationId) },
      select: { isActive: true },
    });
    if (!organisasi || !organisasi.isActive) {
      res.status(404).json({ message: 'Organisasi tidak ditemukan atau sudah nonaktif.' });
      return;
    }

    // Divisi harus benar-benar milik organisasi yang dipilih, supaya jabatan
    // tidak tercatat di bawah struktur yang salah.
    if (departmentId) {
      const divisi = await prisma.department.findUnique({
        where: { id: String(departmentId) },
        select: { organizationId: true },
      });
      if (!divisi || divisi.organizationId !== String(organizationId)) {
        res.status(400).json({ message: 'Divisi yang dipilih bukan bagian dari organisasi ini.' });
        return;
      }
    }

    const bentrok = await prisma.positionSlot.findFirst({
      where: { organizationId: String(organizationId), departmentId: departmentId ? String(departmentId) : null, title },
      select: { id: true },
    });
    if (bentrok) {
      res.status(409).json({ message: `Jabatan "${title}" sudah ada pada struktur ini.` });
      return;
    }

    const newSlot = await prisma.positionSlot.create({
      data: {
        organizationId: String(organizationId),
        departmentId: departmentId ? String(departmentId) : null, // Optional (Bisa jabatan di tingkat organisasi atau tingkat departemen)
        title
      }
    });

    await logActivity(
      req.user.id,
      'CREATE_POSITION_SLOT',
      'PositionSlot',
      `Membuat jabatan "${title}"`,
      newSlot.id
    );

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

    // Slot harus masih ada dan aktif; slot yang sudah dihapus tidak boleh dijabat.
    const slot = await prisma.positionSlot.findUnique({
      where: { id: String(positionSlotId) },
      select: { title: true, isActive: true },
    });
    if (!slot || !slot.isActive) {
      res.status(404).json({ message: 'Jabatan tidak ditemukan atau sudah dihapus.' });
      return;
    }

    // Satu slot hanya untuk satu pejabat aktif; mencegah dua nama tampil di
    // kartu yang sama saat daftar kepengurusan dibaca.
    const sudahDijabat = await prisma.position.findFirst({
      where: { positionSlotId: String(positionSlotId), isActive: true },
      select: { id: true },
    });
    if (sudahDijabat) {
      res.status(409).json({ message: `Jabatan "${slot.title}" sudah dijabat pengurus lain. Turunkan dulu pengurus tersebut.` });
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
        positionSlotId: String(positionSlotId),
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
      // Slot yang sudah dihapus (nonaktif) tidak ditampilkan lagi; riwayat
      // pemegangnya tetap tersimpan untuk audit.
      where: {
        isActive: true,
        ...(organizationId ? { organizationId: String(organizationId) } : {}),
      },
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

/**
 * Mengubah nama / struktur sebuah slot jabatan.
 *
 * Pemegang jabatan aktif tidak dilepas oleh perubahan ini; hanya nama serta
 * penempatan strukturnya yang diperbarui, mis. ketika nomenklatur kepengurusan
 * berganti menjadi "Menteri Kominfo" dari "Departemen Kominfo".
 */
export const updatePositionSlot = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const { id } = req.params;
    const title = String(req.body?.title ?? '').trim();
    const { organizationId, departmentId } = req.body;

    if (!organizationId || !title) {
      res.status(400).json({ message: 'Organisasi dan Nama Jabatan wajib diisi.' });
      return;
    }

    const slot = await prisma.positionSlot.findUnique({
      where: { id },
      select: { id: true, title: true, organizationId: true, departmentId: true },
    });
    if (!slot) {
      res.status(404).json({ message: 'Jabatan tidak ditemukan.' });
      return;
    }

    if (departmentId) {
      const divisi = await prisma.department.findUnique({
        where: { id: String(departmentId) },
        select: { organizationId: true },
      });
      if (!divisi || divisi.organizationId !== String(organizationId)) {
        res.status(400).json({ message: 'Divisi yang dipilih bukan bagian dari organisasi ini.' });
        return;
      }
    }

    const bentrok = await prisma.positionSlot.findFirst({
      where: {
        id: { not: id },
        organizationId: String(organizationId),
        departmentId: departmentId ? String(departmentId) : null,
        title,
        isActive: true,
      },
      select: { id: true },
    });
    if (bentrok) {
      res.status(409).json({ message: `Jabatan "${title}" sudah ada pada struktur ini.` });
      return;
    }

    const updated = await prisma.positionSlot.update({
      where: { id },
      data: {
        title,
        organizationId: String(organizationId),
        departmentId: departmentId ? String(departmentId) : null,
        isActive: true,
      },
    });

    await logActivity(
      req.user.id,
      'UPDATE_POSITION_SLOT',
      'PositionSlot',
      `Mengubah jabatan "${slot.title}" menjadi "${title}"`,
      id
    );

    res.status(200).json({ message: 'Jabatan berhasil diperbarui.', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Menghapus slot jabatan.
 *
 * Slot tidak dihapus permanen dari tabel karena riwayat pemegangnya dipakai
 * audit; yang dilakukan adalah menonaktifkannya sehingga hilang dari daftar
 * kepengurusan. Penghapusan ditolak bila masih ada pengurus aktif di slot itu,
 * agar admin tidak tanpa sengaja menghilangkan jabatan yang sedang dijabat.
 */
export const deletePositionSlot = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const { id } = req.params;

    const slot = await prisma.positionSlot.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        isActive: true,
        positions: { where: { isActive: true }, select: { id: true } },
      },
    });

    if (!slot) {
      res.status(404).json({ message: 'Jabatan tidak ditemukan.' });
      return;
    }

    if (!slot.isActive) {
      res.status(200).json({ message: `Jabatan "${slot.title}" memang sudah tidak aktif.` });
      return;
    }

    if (slot.positions.length > 0) {
      res.status(400).json({
        message: `Jabatan "${slot.title}" masih dijabat ${slot.positions.length} pengurus. Turunkan pengurusnya terlebih dahulu sebelum menghapus jabatan.`,
        jumlahPemegang: slot.positions.length,
      });
      return;
    }

    await prisma.positionSlot.update({ where: { id }, data: { isActive: false } });

    await logActivity(
      req.user.id,
      'DELETE_POSITION_SLOT',
      'PositionSlot',
      `Menghapus jabatan "${slot.title}"`,
      id
    );

    res.status(200).json({ message: `Jabatan "${slot.title}" berhasil dihapus.` });
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