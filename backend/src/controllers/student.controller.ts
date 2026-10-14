import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const getStudents = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Ambil parameter query dari frontend (Pencarian & Pagination)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    // 2. Buat kondisi pencarian (Filter berdasarkan NIM atau Nama)
    const whereCondition: any = {
      role: 'MAHASISWA', // Pastikan HANYA mahasiswa yang tampil
    };

    if (search) {
      whereCondition.OR = [
        { nim: { contains: search } },
        {
          profile: {
            nama: { contains: search }
          }
        }
      ];
    }

    // 3. Eksekusi query ke database
    const [students, total] = await Promise.all([
      // Mengambil data mahasiswa pada halaman saat ini
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          profile: true // Gabungkan (JOIN) dengan tabel profil
        },
        orderBy: {
          nim: 'asc' // Urutkan dari NIM terkecil
        }
      }),
      // Menghitung total seluruh mahasiswa (untuk keperluan nomor halaman)
      prisma.user.count({
        where: whereCondition
      })
    ]);

    // 4. Hitung total halaman
    const totalPages = Math.ceil(total / limit);

    // 5. Kirim balasan
    res.status(200).json({
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};