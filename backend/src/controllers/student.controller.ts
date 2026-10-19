import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import {
  hitungAngkatan,
  runAccountLifecycleJob,
  tenggatHapusEfektif,
} from '../services/account-lifecycle.service';
import { ASSIGNABLE_ROLES, OFFICER_ROLES, isAdminRole } from '../lib/ticket-access';

/**
 * Data akun yang ditampilkan di halaman Data Mahasiswa.
 * Hanya shape ini yang dikirim ke klien supaya hash password tidak pernah bocor.
 */
const akunSelect = {
  id: true,
  nim: true,
  role: true,
  isActive: true,
  first_login: true,
  deactivatedAt: true,
  deactivationType: true,
  tenggatHapus: true,
  perpanjanganHingga: true,
  foto: true,
  createdAt: true,
  profile: {
    select: {
      nama: true,
      nim: true,
      program_studi: true,
      email: true,
      no_hp: true,
      foto: true,
      email_verified_at: true,
    },
  },
  positions: {
    where: { isActive: true },
    select: {
      id: true,
      positionSlot: { select: { title: true, organization: { select: { name: true } } } },
    },
  },
} as const;

// 1. Daftar akun (Mahasiswa & Pengurus) dengan pencarian, filter status, dan role
export const getStudents = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || 'ALL';
    const role = (req.query.role as string) || 'ALL';
    const skip = (page - 1) * limit;

    // Akun pengelola tidak tampil di daftar ini, kecuali bagi SUPERADMIN yang
    // memang bertugas mengelola akun ADMIN. SUPERADMIN sendiri tidak pernah
    // ditampilkan dan tidak bisa diubah dari halaman ini.
    const bisaLihatAdmin = req.user?.role === 'SUPERADMIN';
    const where: any = {
      role: { notIn: bisaLihatAdmin ? ['SUPERADMIN'] : ['ADMIN', 'SUPERADMIN'] },
    };

    if (role !== 'ALL' && ASSIGNABLE_ROLES.includes(role)) {
      if (role !== 'ADMIN' || bisaLihatAdmin) {
        where.role = role;
      }
    }

    if (status === 'AKTIF') where.isActive = true;
    else if (status === 'NONAKTIF') where.isActive = false;

    if (search) {
      where.OR = [
        { nim: { contains: search } },
        { profile: { nama: { contains: search } } },
      ];
    }

    const [akun, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: akunSelect,
        orderBy: { nim: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    const sekarang = new Date();

    const data = akun.map((a) => ({
      ...a,
      angkatan: hitungAngkatan(a.nim),
      email_verified: Boolean(a.profile?.email_verified_at),
      jabatan: a.positions[0]?.positionSlot.title ?? null,
      organisasi: a.positions[0]?.positionSlot.organization.name ?? null,
      // Tanggal terhapus dihitung server supaya aturan bawaan (nonaktif + 1 tahun)
      // dan hasil geseran admin terbaca sama di semua tampilan.
      tenggatHapusEfektif: tenggatHapusEfektif(a),
      diperpanjangSampai:
        a.perpanjanganHingga && a.perpanjanganHingga > sekarang ? a.perpanjanganHingga : null,
    }));

    res.status(200).json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Menambah akun mahasiswa baru (langsung bisa login seperti hasil seed)
export const createStudent = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const nim = String(req.body.nim || '').trim().toUpperCase();
    const nama = String(req.body.nama || '').trim();
    const program_studi = String(req.body.program_studi || '').trim().toUpperCase();
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    const no_hp = req.body.no_hp ? String(req.body.no_hp).trim() : null;

    if (!nim || !nama || !program_studi) {
      res.status(400).json({ message: 'NIM, Nama, dan Program Studi wajib diisi.' });
      return;
    }

    if (!/^\d{8}[A-Za-z]?$/.test(nim)) {
      res.status(400).json({ message: 'Format NIM tidak valid (contoh: 22140001).' });
      return;
    }

    const sudahAda = await prisma.user.findUnique({ where: { nim } });
    if (sudahAda) {
      res.status(409).json({ message: `NIM ${nim} sudah terdaftar di sistem.` });
      return;
    }

    // Sama seperti seed: password awal adalah NIM itu sendiri dan wajib diganti
    // pada login pertama.
    const password_hash = await bcrypt.hash(nim, 10);

    const baru = await prisma.user.create({
      data: {
        nim,
        password_hash,
        role: 'MAHASISWA',
        first_login: true,
        profile: {
          create: { nama, nim, program_studi, email, no_hp },
        },
      },
      select: akunSelect,
    });

    await logActivity(
      req.user.id,
      'CREATE_STUDENT',
      'User',
      `Menambahkan akun mahasiswa ${nama} (${nim})`,
      baru.id
    );

    res.status(201).json({
      message: `Akun ${nama} (${nim}) berhasil dibuat. Password awal sama dengan NIM.`,
      data: { ...baru, angkatan: hitungAngkatan(baru.nim) },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Mengaktifkan / menonaktifkan akun
export const updateStudentStatus = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const isActive = req.body.isActive === true || req.body.isActive === 'true';

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nim: true, role: true, isActive: true, profile: { select: { nama: true } } },
    });

    if (!target) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }

    // Akun pengelola (ADMIN & SUPERADMIN) tidak pernah boleh dinonaktifkan:
    // satu klik keliru bisa mengunci seluruh sistem.
    if (isAdminRole(target.role)) {
      res.status(403).json({ message: 'Akun administrator dan superadmin tidak dapat dinonaktifkan.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      // tenggatHapus selalu dibersihkan di sini: akun aktif tidak menunggu
      // penghapusan, dan akun nonaktif MANUAL tidak pernah dihapus otomatis.
      data: isActive
        ? { isActive: true, deactivatedAt: null, deactivationType: null, tenggatHapus: null }
        : { isActive: false, deactivatedAt: new Date(), deactivationType: 'MANUAL', tenggatHapus: null },
      select: akunSelect,
    });

    await logActivity(
      req.user.id,
      isActive ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT',
      'User',
      `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${target.profile?.nama || target.nim} (${target.nim})`,
      id
    );

    res.status(200).json({
      message: `Akun ${target.profile?.nama || target.nim} berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      data: { ...updated, angkatan: hitungAngkatan(updated.nim) },
    });
  } catch (error) {
    next(error);
  }
};

// 3b. Memperpanjang masa studi & menggeser tenggat hapus (hanya ADMIN).
//     Satu endpoint dipakai untuk dua hal yang selalu berbarengan saat admin
//     menyelamatkan akun yang sudah lewat 5 tahun: memberi tenggat baru dan
//     (opsional) mengaktifkan kembali akun tersebut.
export const perpanjangAkun = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nim: true,
        role: true,
        isActive: true,
        deactivationType: true,
        perpanjanganHingga: true,
        profile: { select: { nama: true } },
      },
    });

    if (!target) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }

    // Siklus hidup hanya mengatur mahasiswa. Akun administrator/superadmin
    // tidak pernah nonaktif, jadi tidak ada yang bisa diperpanjang di sana.
    if (isAdminRole(target.role)) {
      res.status(403).json({ message: 'Akun administrator dan superadmin tidak mengikuti siklus hidup ini.' });
      return;
    }

    const adaPerpanjangan = Object.prototype.hasOwnProperty.call(req.body, 'perpanjanganHingga');
    const adaTenggat = Object.prototype.hasOwnProperty.call(req.body, 'tenggatHapus');
    const aktifkan = req.body.aktifkan === true || req.body.aktifkan === 'true';

    if (!adaPerpanjangan && !adaTenggat && !aktifkan) {
      res.status(400).json({
        message: 'Isi tanggal perpanjangan, tanggal tenggat hapus, atau aktifkan akunnya.',
      });
      return;
    }

    const perpanjanganHingga = adaPerpanjangan
      ? bacaTanggal(req.body.perpanjanganHingga)
      : undefined;
    const tenggatHapus = adaTenggat ? bacaTanggal(req.body.tenggatHapus) : undefined;

    if (perpanjanganHingga === 'INVALID' || tenggatHapus === 'INVALID') {
      res.status(400).json({ message: 'Format tanggal tidak valid.' });
      return;
    }

    const sekarang = new Date();
    const batasAman = new Date(sekarang.getTime() + 24 * 60 * 60 * 1000);

    if (perpanjanganHingga && perpanjanganHingga <= sekarang) {
      res.status(400).json({
        message: 'Tanggal perpanjangan harus di masa depan. Kosongkan untuk mencabut perpanjangan.',
      });
      return;
    }

    // Tenggat hapus yang sudah lewat akan langsung dieksekusi job berikutnya,
    // jadi beri jeda minimal sehari supaya admin tidak menghapus data tak sengaja.
    if (tenggatHapus && tenggatHapus <= batasAman) {
      res.status(400).json({
        message: 'Tenggat hapus minimal sehari dari sekarang. Kosongkan untuk memakai aturan bawaan.',
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(perpanjanganHingga !== undefined ? { perpanjanganHingga } : {}),
        ...(tenggatHapus !== undefined ? { tenggatHapus } : {}),
        ...(aktifkan
          ? { isActive: true, deactivatedAt: null, deactivationType: null }
          : {}),
      },
      select: akunSelect,
    });

    const nama = target.profile?.nama || target.nim;
    const rincian: string[] = [];
    if (perpanjanganHingga !== undefined) {
      rincian.push(
        perpanjanganHingga
          ? `masa studi diperpanjang sampai ${perpanjanganHingga.toISOString().slice(0, 10)}`
          : 'perpanjangan masa studi dicabut'
      );
    }
    if (tenggatHapus !== undefined) {
      rincian.push(
        tenggatHapus
          ? `tenggat hapus digeser ke ${tenggatHapus.toISOString().slice(0, 10)}`
          : 'tenggat hapus dikembalikan ke aturan bawaan'
      );
    }
    if (aktifkan) rincian.push('akun diaktifkan kembali');

    await logActivity(
      req.user.id,
      'PERPANJANG_AKUN',
      'User',
      `Akun ${nama} (${target.nim}): ${rincian.join(', ')}`,
      id
    );

    res.status(200).json({
      message: `Pengaturan akun ${nama} diperbarui: ${rincian.join(', ')}.`,
      data: {
        ...updated,
        angkatan: hitungAngkatan(updated.nim),
        tenggatHapusEfektif: tenggatHapusEfektif(updated),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Menetapkan role pengurus (hanya ADMIN)
export const updateStudentRole = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const role = String(req.body.role || '').trim().toUpperCase();

    // SUPERADMIN boleh ditetapkan, tetapi hanya oleh sesama SUPERADMIN.
    if (!ASSIGNABLE_ROLES.includes(role) && role !== 'SUPERADMIN') {
      res.status(400).json({ message: 'Role tidak dikenali.' });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nim: true, role: true, profile: { select: { nama: true } } },
    });

    if (!target) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }

    // Tidak ada yang boleh mengubah role akunnya sendiri. Tanpa penjaga ini,
    // admin terakhir bisa menurunkan dirinya dan mengunci seluruh sistem.
    if (target.id === req.user.id) {
      res.status(403).json({ message: 'Anda tidak dapat mengubah role akun sendiri.' });
      return;
    }

    // Mengubah role akun pengelola adalah wewenang SUPERADMIN saja.
    if (isAdminRole(target.role) && req.user.role !== 'SUPERADMIN') {
      res.status(403).json({
        message: 'Role akun administrator hanya dapat diubah oleh superadmin.',
      });
      return;
    }

    // Menetapkan SUPERADMIN juga hanya boleh dilakukan SUPERADMIN.
    if (role === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
      res.status(403).json({ message: 'Hanya superadmin yang dapat menetapkan role superadmin.' });
      return;
    }

    // SUPERADMIN yang sedang diubah harus menyisakan minimal satu superadmin
    // lain, supaya sistem tidak pernah kehilangan pengelola webnya.
    if (target.role === 'SUPERADMIN') {
      const jumlahSuperadmin = await prisma.user.count({ where: { role: 'SUPERADMIN' } });
      if (jumlahSuperadmin <= 1) {
        res.status(403).json({
          message: 'Minimal harus ada satu superadmin. Tetapkan superadmin lain sebelum mengubah yang terakhir.',
        });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: akunSelect,
    });

    await logActivity(
      req.user.id,
      'UPDATE_ROLE',
      'User',
      `Mengubah role ${target.profile?.nama || target.nim} dari ${target.role} menjadi ${role}`,
      id
    );

    res.status(200).json({
      message: `Role ${target.profile?.nama || target.nim} berhasil diubah menjadi ${role}.`,
      data: { ...updated, angkatan: hitungAngkatan(updated.nim) },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Menjalankan pemeriksaan siklus hidup akun secara manual (hanya ADMIN)
export const runLifecycle = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hasil = await runAccountLifecycleJob();
    res.status(200).json({
      message:
        `${hasil.dinonaktifkan} akun dinonaktifkan otomatis, ` +
        `${hasil.dihapus} akun dihapus permanen.`,
      data: hasil,
    });
  } catch (error) {
    next(error);
  }
};

const TANGGAL_POLOS = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Membaca isian tanggal dari admin.
 * Tanggal polos (2026-12-31) dibaca sebagai AKHIR hari itu, sehingga
 * "perpanjang sampai 31 Des" berarti masih berlaku sepanjang tanggal tersebut.
 * Mengembalikan null untuk isian kosong (artinya: kembalikan ke aturan bawaan).
 */
const bacaTanggal = (nilai: unknown): Date | null | 'INVALID' => {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai !== 'string') return 'INVALID';

  const teks = nilai.trim();
  const tanggal = TANGGAL_POLOS.test(teks)
    ? new Date(`${teks}T23:59:59.999`)
    : new Date(teks);

  return Number.isNaN(tanggal.getTime()) ? 'INVALID' : tanggal;
};

/** Penjaga khusus: hanya pengurus & admin yang boleh menyentuh data mahasiswa. */
export const requireOfficer = (req: any, res: Response, next: NextFunction): void => {
  if (!req.user || !(OFFICER_ROLES.includes(req.user.role) || isAdminRole(req.user.role))) {
    res.status(403).json({ message: 'Hanya pengurus dan admin yang dapat mengakses data ini.' });
    return;
  }
  next();
};

export const requireAdmin = (req: any, res: Response, next: NextFunction): void => {
  if (!req.user || !isAdminRole(req.user.role)) {
    res.status(403).json({ message: 'Hanya admin yang dapat melakukan tindakan ini.' });
    return;
  }
  next();
};
