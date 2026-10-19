import { Response, NextFunction } from 'express';
import { logActivity } from '../services/audit.service';
import prisma from '../lib/prisma';
import { isAdminRole } from '../lib/ticket-access';

// 1. Mahasiswa mengajukan perubahan data
export const createRequest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { requestData, reason } = req.body; 

    if (!requestData || Object.keys(requestData).length === 0) {
      res.status(400).json({ message: 'Data perubahan tidak boleh kosong.' });
      return;
    }

    const newRequest = await prisma.dataChangeRequest.create({
      data: {
        userId,
        requestData,
        reason,
        status: 'PENDING'
      }
    });

    res.status(201).json({ message: 'Pengajuan perubahan data berhasil dikirim.', data: newRequest });
  } catch (error) {
    next(error);
  }
};

// 2. Admin melihat semua pengajuan
export const getRequests = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    let whereCondition = {};

    if (user.role === 'MAHASISWA') {
      whereCondition = { userId: user.id };
    }

    const requests = await prisma.dataChangeRequest.findMany({
      where: whereCondition,
      include: {
        user: { 
          include: { 
            profile: true 
          } 
        },
        reviewer: { 
          select: { 
            role: true, 
            profile: { select: { nama: true } } 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sanitasi data: pastikan requestData berbentuk JSON object yang valid
    // dan pastikan array selalu dikembalikan meskipun kosong
    const sanitizedRequests = requests.map(req => {
      let parsedData = req.requestData;
      // Jika Prisma membacanya sebagai string JSON, kita parse
      if (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (e) {
          parsedData = {};
        }
      }
      return {
        ...req,
        requestData: parsedData || {}
      };
    });

    res.status(200).json({ data: sanitizedRequests });
  } catch (error) {
    next(error);
  }
};

// 3. Admin memproses pengajuan (Approve / Reject)
export const processRequest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // <-- Typo kurawal ekstra sudah dihapus di sini
    // [PERBAIKAN KEAMANAN] Hanya ADMIN/SUPERADMIN yang boleh memproses pengajuan perubahan data.
    if (!isAdminRole(req.user?.role)) {
      res.status(403).json({ message: 'Akses ditolak: khusus Admin.' });
      return;
    }

    const reviewerId = req.user.id;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ message: 'Status tidak valid.' });
      return;
    }

    const request = await prisma.dataChangeRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ message: 'Data pengajuan tidak ditemukan.' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ message: 'Pengajuan ini sudah diproses sebelumnya.' });
      return;
    }

    if (status === 'APPROVED') {
      const updateData = request.requestData as Record<string, any>;
      
      await prisma.studentProfile.update({
        where: { userId: request.userId },
        data: {
          nama: updateData.nama,
          program_studi: updateData.program_studi,
          email: updateData.email,
          no_hp: updateData.no_hp,
        }
      });
    }

    const updatedRequest = await prisma.dataChangeRequest.update({
      where: { id },
      data: {
        status, // <-- TypeScript sekarang sudah mengenali status dengan benar
        reviewedById: reviewerId,
        reviewedAt: new Date()
      }
    });

    await logActivity(
      reviewerId, 
      status === 'APPROVED' ? 'APPROVE_DATA' : 'REJECT_DATA', 
      'DataChangeRequest', 
      `Admin memproses pengajuan perubahan data dari User ID: ${request.userId}`,
      id
    );

    res.status(200).json({ message: `Pengajuan berhasil di-${status.toLowerCase()}.`, data: updatedRequest });
  } catch (error) {
    next(error);
  }
};