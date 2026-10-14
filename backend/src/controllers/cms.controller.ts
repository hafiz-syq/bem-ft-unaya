import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Mengambil semua konten (Bisa diakses Publik)
export const getContents = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type } = req.query;
    const whereCondition = type ? { type: String(type), status: 'PUBLISHED' } : { status: 'PUBLISHED' };
    
    const contents = await prisma.content.findMany({
      where: whereCondition,
      include: {
        author: { select: { nim: true, role: true, profile: { select: { nama: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ data: contents });
  } catch (error) { next(error); }
};

// Mengambil detail 1 konten (Berita/Artikel/Program)
export const getContentById = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const content = await prisma.content.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { profile: { select: { nama: true } } } }
      }
    });
    
    if (!content) {
      res.status(404).json({ message: 'Konten tidak ditemukan' });
      return;
    }
    
    res.status(200).json({ data: content });
  } catch (error) { next(error); }
};

// Membuat konten baru (Hanya Admin & Pengurus)
export const createContent = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, title, content } = req.body;
    const file = req.file; // Tangkap file gambar jika ada

    if (!type || !title || !content) {
      res.status(400).json({ message: 'Semua kolom wajib diisi.' }); return;
    }

    // Jika ada file, buat path url-nya
    const imagePath = file ? `/uploads/${file.filename}` : null;

    const newContent = await prisma.content.create({
      data: { type, title, content, image: imagePath, authorId: req.user.id }
    });
    res.status(201).json({ message: 'Konten berhasil dipublikasikan!', data: newContent });
  } catch (error) { next(error); }
};

// Menghapus konten
export const deleteContent = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.content.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Konten berhasil dihapus.' });
  } catch (error) { next(error); }
};

// ================= AGENDA =================
export const getAgendas = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agendas = await prisma.agenda.findMany({
      orderBy: { date: 'asc' },
      include: { author: { select: { profile: { select: { nama: true } } } } }
    });
    res.status(200).json({ data: agendas });
  } catch (error) { next(error); }
};

export const createAgenda = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, description, date, time, location, registrationLink } = req.body;
    const newAgenda = await prisma.agenda.create({
      data: { 
        title, description, date: new Date(date), time, location, registrationLink, 
        authorId: req.user.id 
      }
    });
    res.status(201).json({ message: 'Agenda berhasil dibuat', data: newAgenda });
  } catch (error) { next(error); }
};

export const deleteAgenda = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.agenda.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Agenda dihapus' });
  } catch (error) { next(error); }
};

// ================= GALERI =================
export const getGalleries = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const galleries = await prisma.gallery.findMany({ orderBy: { createdAt: 'desc' } });
    res.status(200).json({ data: galleries });
  } catch (error) { next(error); }
};

export const createGallery = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, category, activity, year } = req.body;
    const file = req.file;

    if (!file) { res.status(400).json({ message: 'File gambar wajib diunggah.' }); return; }

    const newGallery = await prisma.gallery.create({
      data: {
        title, category, activity, year: parseInt(year),
        url: `/uploads/${file.filename}`,
        uploaderId: req.user.id
      }
    });
    res.status(201).json({ message: 'Galeri berhasil diunggah', data: newGallery });
  } catch (error) { next(error); }
};

export const deleteGallery = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Galeri dihapus' });
  } catch (error) { next(error); }
};

// ================= STRUKTUR ORGANISASI (PUBLIK) =================
export const getPublicStructure = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Menarik data organisasi beserta pengurusnya yang sedang aktif
    const structure = await prisma.organization.findMany({
      where: { isActive: true },
      include: {
        positionSlots: {
          where: { isActive: true },
          include: {
            positions: {
              where: { isActive: true },
              include: { user: { include: { profile: true } } }
            }
          }
        }
      }
    });
    res.status(200).json({ data: structure });
  } catch (error) { next(error); }
};