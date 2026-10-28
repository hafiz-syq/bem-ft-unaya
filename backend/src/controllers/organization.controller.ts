import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isJenisOrganisasi, JENIS_ORGANISASI, LABEL_JENIS } from '../lib/organisasi';

/** Label tipe organisasi untuk pesan & log; nilai tak dikenal ditampilkan apa adanya. */
const labelJenis = (nilai: string): string => (isJenisOrganisasi(nilai) ? LABEL_JENIS[nilai] : nilai);

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
    // Tipe organisasi menentukan tingkat visibilitas arsip surat
    // (HIMPUNAN < BEM < DPM). Kosong dianggap himpunan.
    const kind = req.body?.kind === undefined || req.body?.kind === null || req.body?.kind === ''
      ? 'HIMPUNAN'
      : String(req.body.kind).toUpperCase();

    if (!name) {
      res.status(400).json({ message: 'Nama organisasi wajib diisi.' });
      return;
    }
    if (!isJenisOrganisasi(kind)) {
      res.status(400).json({
        message: `Tipe organisasi harus salah satu dari: ${JENIS_ORGANISASI.map((j) => LABEL_JENIS[j]).join(', ')}.`,
      });
      return;
    }

    const newOrg = await prisma.organization.create({
      data: { name, kind }
    });

    res.status(201).json({ message: 'Organisasi berhasil ditambahkan.', data: newOrg });
  } catch (error) {
    next(error);
  }
};

// 2b. Mengganti nama organisasi yang sudah ada.
//     Nama diperiksa kosong dan tidak boleh sama dengan organisasi lain (tanpa
//     membedakan huruf besar/kecil) supaya daftar tidak punya dua entri identik.
export const renameOrganization = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name ?? '').trim();

    if (!name) {
      res.status(400).json({ message: 'Nama organisasi wajib diisi.' });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, kind: true },
    });
    if (!org) {
      res.status(404).json({ message: 'Organisasi tidak ditemukan.' });
      return;
    }

    // Tipe organisasi boleh ikut diubah (opsional) karena menentukan tingkat
    // visibilitas arsip surat.
    let kindBaru: string | undefined;
    if (req.body?.kind !== undefined && req.body?.kind !== null && req.body?.kind !== '') {
      const nilai = String(req.body.kind).toUpperCase();
      if (!isJenisOrganisasi(nilai)) {
        res.status(400).json({
          message: `Tipe organisasi harus salah satu dari: ${JENIS_ORGANISASI.map((j) => LABEL_JENIS[j]).join(', ')}.`,
        });
        return;
      }
      kindBaru = nilai;
    }

    const bentrok = await prisma.organization.findFirst({
      where: { name, id: { not: id } },
      select: { id: true },
    });
    if (bentrok) {
      res.status(409).json({ message: `Organisasi dengan nama "${name}" sudah ada.` });
      return;
    }

    if (org.name === name && (kindBaru === undefined || kindBaru === org.kind)) {
      res.status(200).json({ message: 'Nama organisasi tidak berubah.', data: org });
      return;
    }

    const perubahan: { name?: string; kind?: string } = {};
    if (org.name !== name) perubahan.name = name;
    if (kindBaru !== undefined && kindBaru !== org.kind) perubahan.kind = kindBaru;

    const diperbarui = await prisma.organization.update({ where: { id }, data: perubahan });

    const rincian = [
      org.name !== name ? `nama dari "${org.name}" menjadi "${name}"` : '',
      perubahan.kind ? `tipe dari ${labelJenis(org.kind)} menjadi ${labelJenis(perubahan.kind)}` : '',
    ].filter(Boolean).join(', ');

    await logActivity(
      req.user.id,
      'UPDATE_ORGANIZATION',
      'Organization',
      `Mengubah ${rincian}`,
      id
    );

    res.status(200).json({ message: `Organisasi "${diperbarui.name}" diperbarui.`, data: diperbarui });
  } catch (error) {
    next(error);
  }
};

// 2c. Mengganti nama departemen (divisi) di dalam sebuah organisasi.
export const renameDepartment = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name ?? '').trim();

    if (!name) {
      res.status(400).json({ message: 'Nama divisi wajib diisi.' });
      return;
    }

    const dept = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, organizationId: true },
    });
    if (!dept) {
      res.status(404).json({ message: 'Divisi tidak ditemukan.' });
      return;
    }

    const bentrok = await prisma.department.findFirst({
      where: { name, organizationId: dept.organizationId, id: { not: id } },
      select: { id: true },
    });
    if (bentrok) {
      res.status(409).json({ message: `Divisi dengan nama "${name}" sudah ada di organisasi ini.` });
      return;
    }

    if (dept.name === name) {
      res.status(200).json({ message: 'Nama divisi tidak berubah.', data: dept });
      return;
    }

    const diperbarui = await prisma.department.update({ where: { id }, data: { name } });

    await logActivity(
      req.user.id,
      'UPDATE_DEPARTMENT',
      'Department',
      `Mengganti nama divisi dari "${dept.name}" menjadi "${name}"`,
      id
    );

    res.status(200).json({ message: `Nama divisi diubah menjadi "${name}".`, data: diperbarui });
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

// 4. Menghapus organisasi beserta seluruh divisi dan slot jabatannya.
//
//    Dua penjaga, mengikuti pola hapus divisi di bawah:
//    - Bila masih ada pengurus AKTIF di bawah organisasi ini, penghapusan
//      ditolak; admin harus menurunkan pengurusnya lebih dulu.
//    - Bila yang tersisa hanya riwayat jabatan lama (tidak ada yang aktif),
//      penghapusan hanya jalan bila admin meminta tegas lewat force=true,
//      karena slot dan riwayat jabatan tersebut akan ikut terhapus.
//
//    Catatan: tujuan tiket memakai enum (bukan id organisasi), jadi menghapus
//    baris organisasi tidak merusak hak baca tiket yang sudah ada.
export const deleteOrganization = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const paksa = req.query.force === 'true' || req.body?.force === true || req.body?.force === 'true';

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true } },
        positionSlots: {
          select: {
            id: true,
            title: true,
            positions: { select: { id: true, isActive: true } },
          },
        },
      },
    });

    if (!org) {
      res.status(404).json({ message: 'Organisasi tidak ditemukan.' });
      return;
    }

    const slotDenganPengurusAktif = org.positionSlots.filter((slot) =>
      slot.positions.some((p) => p.isActive)
    );

    if (slotDenganPengurusAktif.length > 0) {
      res.status(400).json({
        message:
          `Organisasi "${org.name}" masih memiliki pengurus aktif pada jabatan: ` +
          slotDenganPengurusAktif.map((s) => s.title).join(', ') +
          '. Turunkan pengurus tersebut terlebih dahulu sebelum menghapus organisasi.'
      });
      return;
    }

    const jumlahRiwayat = org.positionSlots.reduce((total, s) => total + s.positions.length, 0);

    if (jumlahRiwayat > 0 && !paksa) {
      res.status(400).json({
        message:
          `Organisasi "${org.name}" masih menyimpan ${jumlahRiwayat} riwayat jabatan lama. ` +
          'Hapus organisasi ini akan menghapus riwayat tersebut juga. Kirim ulang dengan force=true bila memang disengaja.',
        butuhKonfirmasi: true,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Urutan penting: jabatan -> slot -> divisi -> organisasi.
      const slotIds = org.positionSlots.map((s) => s.id);
      if (slotIds.length > 0) {
        await tx.position.deleteMany({ where: { positionSlotId: { in: slotIds } } });
      }
      await tx.positionSlot.deleteMany({ where: { organizationId: id } });
      await tx.department.deleteMany({ where: { organizationId: id } });
      await tx.organization.delete({ where: { id } });
    });

    await logActivity(
      req.user.id,
      'DELETE_ORGANIZATION',
      'Organization',
      `Menghapus organisasi ${org.name} beserta ${org.departments.length} divisi, ` +
        `${org.positionSlots.length} slot jabatan, dan ${jumlahRiwayat} riwayat jabatan`,
      id
    );

    res.status(200).json({
      message: `Organisasi "${org.name}" berhasil dihapus.`,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Menghapus Departemen (divisi) beserta slot jabatannya.
//    Ditolak bila masih ada pengurus AKTIF yang menjabat di divisi tersebut,
//    supaya riwayat kepengurusan tidak hilang tanpa sengaja.
export const deleteDepartment = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        positionSlots: {
          include: { positions: { where: { isActive: true } } }
        }
      }
    });

    if (!dept) {
      res.status(404).json({ message: 'Divisi tidak ditemukan.' });
      return;
    }

    const slotTerpakai = dept.positionSlots.filter((slot) => slot.positions.length > 0);
    if (slotTerpakai.length > 0) {
      res.status(400).json({
        message:
          `Divisi "${dept.name}" masih memiliki pengurus aktif pada jabatan: ` +
          slotTerpakai.map((s) => s.title).join(', ') +
          '. Turunkan pengurus tersebut terlebih dahulu sebelum menghapus divisi.'
      });
      return;
    }

    // Hitung seluruh riwayat jabatan di divisi ini, termasuk yang sudah tidak
    // aktif: relasi `dept.positionSlots.positions` di atas sengaja hanya
    // memuat pemegang aktif untuk penjagaan penghapusan.
    const jumlahRiwayat = await prisma.position.count({
      where: { positionSlot: { departmentId: id } },
    });
    const slotIds = dept.positionSlots.map((slot) => slot.id);

    await prisma.$transaction(async (tx) => {
      // Urutan penting: riwayat jabatan -> slot -> divisi. Tabel Position masih
      // menunjuk ke PositionSlot lewat foreign key RESTRICT, jadi menghapus slot
      // lebih dulu melanggar batas relasi dan memunculkan error
      // "Foreign key constraint violated" seperti yang pernah terjadi.
      if (slotIds.length > 0) {
        await tx.position.deleteMany({ where: { positionSlotId: { in: slotIds } } });
      }
      await tx.positionSlot.deleteMany({ where: { departmentId: id } });
      await tx.department.delete({ where: { id } });
    });

    await logActivity(
      req.user.id,
      'DELETE_DEPARTMENT',
      'Department',
      `Menghapus divisi ${dept.name} beserta ${dept.positionSlots.length} slot jabatannya dan ${jumlahRiwayat} riwayat jabatan`,
      id
    );

    res.status(200).json({ message: `Divisi "${dept.name}" berhasil dihapus.` });
  } catch (error) {
    next(error);
  }
};