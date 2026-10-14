import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// 1. Mengambil Semua Data Organisasi beserta Departemennya
export const getOrganizations = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        departments: true, // Ambil juga data departemen di dalamnya
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({ data: organizations });
  } catch (error) {
    next(error);
  }
};

// 2. Membuat Organisasi Baru
export const createOrganization = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Nama organisasi wajib diisi.' });
      return;
    }

    const newOrg = await prisma.organization.create({
      data: { name }
    });

    res.status(201).json({ message: 'Organisasi berhasil ditambahkan.', data: newOrg });
  } catch (error) {
    next(error);
  }
};

// 3. Membuat Departemen Baru di dalam sebuah Organisasi
export const createDepartment = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId, name } = req.body;

    if (!organizationId || !name) {
      res.status(400).json({ message: 'ID Organisasi dan Nama Departemen wajib diisi.' });
      return;
    }

    const newDept = await prisma.department.create({
      data: {
        organizationId,
        name
      }
    });

    res.status(201).json({ message: 'Departemen berhasil ditambahkan.', data: newDept });
  } catch (error) {
    next(error);
  }
};