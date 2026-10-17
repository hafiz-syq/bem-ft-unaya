import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';

/**
 * Riwayat demisioner (pengurus lama) DPM & BEM Teknik.
 * Publik boleh membaca; hanya admin yang boleh menambah/mengubah/menghapus.
 */

export const getDemisioner = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organization } = req.query;

    const data = await prisma.demisioner.findMany({
      where: organization ? { organization: String(organization) } : {},
      orderBy: [{ organization: 'asc' }, { periode: 'desc' }, { nama: 'asc' }]
    });

    res.status(200).json({ data });
  } catch (error) { next(error); }
};

export const createDemisioner = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organization, nama, nim, jabatan, periode, description } = req.body;

    if (!organization || !nama || !nim || !periode) {
      res.status(400).json({ message: 'Organisasi, Nama, NIM, dan Periode wajib diisi.' });
      return;
    }

    const foto = req.file ? `/uploads/${req.file.filename}` : null;

    const baru = await prisma.demisioner.create({
      data: {
        organization: String(organization).toUpperCase(),
        nama, nim,
        jabatan: jabatan || null,
        periode,
        description: description || null,
        foto
      }
    });

    await logActivity(
      req.user.id, 'CREATE_DEMISIONER', 'Demisioner',
      `Menambahkan demisioner ${nama} (${organization} ${periode})`, baru.id
    );

    res.status(201).json({ message: `Data demisioner ${nama} berhasil ditambahkan.`, data: baru });
  } catch (error) { next(error); }
};

export const updateDemisioner = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { organization, nama, nim, jabatan, periode, description } = req.body;

    const lama = await prisma.demisioner.findUnique({ where: { id } });
    if (!lama) { res.status(404).json({ message: 'Data demisioner tidak ditemukan.' }); return; }

    const foto = req.file ? `/uploads/${req.file.filename}` : undefined;

    const updated = await prisma.demisioner.update({
      where: { id },
      data: {
        ...(organization ? { organization: String(organization).toUpperCase() } : {}),
        ...(nama ? { nama } : {}),
        ...(nim ? { nim } : {}),
        ...(jabatan !== undefined ? { jabatan: jabatan || null } : {}),
        ...(periode ? { periode } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(foto ? { foto } : {})
      }
    });

    await logActivity(req.user.id, 'UPDATE_DEMISIONER', 'Demisioner', `Memperbarui demisioner ${updated.nama}`, id);

    res.status(200).json({ message: 'Data demisioner berhasil diperbarui.', data: updated });
  } catch (error) { next(error); }
};

export const deleteDemisioner = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lama = await prisma.demisioner.findUnique({ where: { id: req.params.id } });
    await prisma.demisioner.delete({ where: { id: req.params.id } });
    await logActivity(
      req.user.id, 'DELETE_DEMISIONER', 'Demisioner',
      `Menghapus demisioner ${lama?.nama ?? req.params.id}`, req.params.id
    );
    res.status(200).json({ message: 'Data demisioner berhasil dihapus.' });
  } catch (error) { next(error); }
};
