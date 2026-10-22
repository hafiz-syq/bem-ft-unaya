import { NextFunction, Response } from 'express';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';

/**
 * Pengelolaan kunci perangkat oleh ADMIN/SUPERADMIN.
 *
 * Alur yang didukung:
 * - IZINKAN: akun yang sedang terikat dipindahkan ke perangkat yang terakhir
 *   mencoba login. Percobaan itu tercatat otomatis saat login ditolak.
 * - LEPAS: kunci dilepas sehingga akun bisa login dari perangkat mana pun.
 * - TOLAK: percobaan perangkat baru diabaikan tanpa mengganggu perangkat lama.
 *
 * Setiap IZINKAN/LEPAS menaikkan `sessionVersion`, jadi token lama langsung
 * tidak berlaku. TOLAK tidak menyentuh sesi karena perangkat lama tetap sah.
 */

const PILIHAN_AKUN = {
  id: true,
  nim: true,
  role: true,
  isActive: true,
  deviceId: true,
  deviceLabel: true,
  deviceBoundAt: true,
  pendingDeviceId: true,
  pendingDeviceLabel: true,
  pendingDeviceAt: true,
  // Batas perangkat aktif bersamaan + perangkat tambahan (akun multi-perangkat).
  maxDevices: true,
  devices: { select: { label: true, boundAt: true } },
  profile: { select: { nama: true, program_studi: true } },
} as const;

type Mode = 'IZINKAN' | 'LEPAS' | 'TOLAK';

/** ADMIN tidak boleh mengelola akun pengelola lain; hanya SUPERADMIN yang boleh. */
const bolehKelola = (aktor: { id: string; role: string }, target: { id: string; role: string }): boolean => {
  if (aktor.id === target.id) return true;
  if (!isAdminRole(target.role)) return true;
  return aktor.role === 'SUPERADMIN';
};

export const getPerangkat = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const halaman = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const batas = Math.min(50, Math.max(5, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const cari = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'SEMUA';

    const where: any = {};

    if (cari) {
      where.OR = [
        { nim: { contains: cari } },
        { profile: { is: { nama: { contains: cari } } } },
      ];
    }

    if (status === 'TERIKAT') where.deviceId = { not: null };
    else if (status === 'MENUNGGU') where.pendingDeviceId = { not: null };
    else if (status === 'BEBAS') where.deviceId = null;

    const [akun, total, terikat, menunggu, bebas] = await Promise.all([
      prisma.user.findMany({
        where,
        select: PILIHAN_AKUN,
        orderBy: { nim: 'asc' },
        skip: (halaman - 1) * batas,
        take: batas,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { deviceId: { not: null } } }),
      prisma.user.count({ where: { pendingDeviceId: { not: null } } }),
      prisma.user.count({ where: { deviceId: null } }),
    ]);

    res.status(200).json({
      data: akun.map((a) => ({
        id: a.id,
        nim: a.nim,
        nama: a.profile?.nama ?? null,
        programStudi: a.profile?.program_studi ?? null,
        role: a.role,
        isActive: a.isActive,
        terikat: Boolean(a.deviceId),
        // ID perangkat sengaja TIDAK dikirim ke klien: bukan informasi yang
        // dibutuhkan admin dan tidak berguna bila bocor.
        perangkat: a.deviceId
          ? { label: a.deviceLabel ?? 'Perangkat tidak dikenal', sejak: a.deviceBoundAt }
          : null,
        // Batas perangkat akun dan jumlah yang sedang terpakai (perangkat utama
        // di kolom User + perangkat tambahan di tabel UserDevice).
        maxDevices: a.maxDevices,
        jumlahPerangkat: (a.deviceId ? 1 : 0) + a.devices.length,
        perangkatTambahan: a.devices.map((d) => ({ label: d.label ?? 'Perangkat tidak dikenal', sejak: d.boundAt })),
        percobaan: a.pendingDeviceId
          ? { label: a.pendingDeviceLabel ?? 'Perangkat tidak dikenal', pada: a.pendingDeviceAt }
          : null,
        dapatDikelola: bolehKelola(req.user, a),
      })),
      meta: {
        page: halaman,
        limit: batas,
        total,
        totalHalaman: Math.max(1, Math.ceil(total / batas)),
        statistik: { total: terikat + bebas, terikat, menunggu, bebas },
      },
    });
  } catch (error) { next(error); }
};

export const kelolaPerangkat = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mode = String(req.body?.mode ?? 'LEPAS').toUpperCase() as Mode;
    if (!['IZINKAN', 'LEPAS', 'TOLAK'].includes(mode)) {
      res.status(400).json({ message: 'Mode pengelolaan perangkat tidak dikenal.' });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: PILIHAN_AKUN,
    });

    if (!target) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }

    if (!bolehKelola(req.user, target)) {
      res.status(403).json({
        message: 'Hanya SUPERADMIN yang boleh mengelola perangkat akun ADMIN/SUPERADMIN.',
      });
      return;
    }

    const diriSendiri = target.id === req.user.id;
    const nama = target.profile?.nama ?? target.nim;

    if (mode === 'TOLAK') {
      if (!target.pendingDeviceId) {
        res.status(400).json({ message: 'Tidak ada percobaan perangkat baru untuk ditolak.' });
        return;
      }

      await prisma.user.update({
        where: { id: target.id },
        data: { pendingDeviceId: null, pendingDeviceLabel: null, pendingDeviceAt: null },
      });

      await logActivity(
        req.user.id,
        'DEVICE_REJECT',
        'User',
        `Menolak percobaan login perangkat baru (${target.pendingDeviceLabel ?? 'perangkat tidak dikenal'}) untuk ${nama}`,
        target.id
      );

      res.status(200).json({
        message: `Percobaan perangkat baru untuk ${nama} ditolak. Perangkat lama tetap berlaku.`,
        perluLoginUlang: false,
      });
      return;
    }

    if (mode === 'IZINKAN') {
      if (!target.pendingDeviceId) {
        res.status(400).json({ message: 'Tidak ada perangkat baru yang bisa diizinkan untuk akun ini.' });
        return;
      }

      const jumlahTerpakai = (target.deviceId ? 1 : 0) + target.devices.length;

      // Bila batas perangkat akun masih menyisakan slot, perangkat baru cukup
      // ditambahkan tanpa mengeluarkan perangkat lama.
      if (jumlahTerpakai < Math.max(1, target.maxDevices)) {
        await prisma.userDevice.create({
          data: {
            userId: target.id,
            deviceId: target.pendingDeviceId,
            label: target.pendingDeviceLabel,
          },
        });

        await prisma.user.update({
          where: { id: target.id },
          data: { pendingDeviceId: null, pendingDeviceLabel: null, pendingDeviceAt: null },
        });

        await logActivity(
          req.user.id,
          'DEVICE_ALLOW',
          'User',
          `Menambahkan perangkat (${target.pendingDeviceLabel ?? 'perangkat tidak dikenal'}) untuk ${nama}`,
          target.id
        );

        res.status(200).json({
          message: `Perangkat baru untuk ${nama} ditambahkan (${jumlahTerpakai + 1} dari ${target.maxDevices}). Perangkat lama tetap aktif.`,
          perluLoginUlang: false,
        });
        return;
      }

      await prisma.user.update({
        where: { id: target.id },
        data: {
          deviceId: target.pendingDeviceId,
          deviceLabel: target.pendingDeviceLabel,
          deviceBoundAt: target.pendingDeviceAt ?? new Date(),
          pendingDeviceId: null,
          pendingDeviceLabel: null,
          pendingDeviceAt: null,
          sessionVersion: { increment: 1 },
        },
      });

      await logActivity(
        req.user.id,
        'DEVICE_ALLOW',
        'User',
        `Mengizinkan perangkat baru (${target.pendingDeviceLabel ?? 'perangkat tidak dikenal'}) untuk ${nama}`,
        target.id
      );

      res.status(200).json({
        message: `Perangkat baru untuk ${nama} diizinkan. Perangkat lama otomatis keluar; pengguna dapat login di perangkat baru.`,
        perluLoginUlang: diriSendiri,
      });
      return;
    }

    // LEPAS
    if (!target.deviceId) {
      res.status(400).json({ message: 'Akun ini belum terikat ke perangkat mana pun.' });
      return;
    }

    await prisma.$transaction([
      prisma.userDevice.deleteMany({ where: { userId: target.id } }),
      prisma.user.update({
        where: { id: target.id },
        data: {
          deviceId: null,
          deviceLabel: null,
          deviceBoundAt: null,
          pendingDeviceId: null,
          pendingDeviceLabel: null,
          pendingDeviceAt: null,
          sessionVersion: { increment: 1 },
        },
      }),
    ]);

    await logActivity(
      req.user.id,
      'DEVICE_RESET',
      'User',
      `Membuka kunci perangkat untuk ${nama}`,
      target.id
    );

    res.status(200).json({
      message: `Kunci perangkat ${nama} dibuka. Pengguna dapat login di perangkat mana pun; sesi lama otomatis berakhir.`,
      perluLoginUlang: diriSendiri,
    });
  } catch (error) { next(error); }
};

/**
 * Mengatur berapa perangkat yang boleh aktif bersamaan untuk satu akun.
 *
 * 1 = perilaku lama (satu akun satu perangkat). Nilai maksimum dibatasi 5 agar
 * akun tidak dipakai berpindah-pindah tanpa kendali. Menurunkan batas TIDAK
 * memutus perangkat yang sudah terdaftar; untuk memutus semuanya tetap pakai
 * mode LEPAS, supaya admin tidak tanpa sengaja mengeluarkan pengguna.
 */
export const aturBatasPerangkat = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batas = parseInt(String(req.body?.maxDevices ?? ''), 10);

    if (!Number.isInteger(batas) || batas < 1 || batas > 5) {
      res.status(400).json({ message: 'Batas perangkat harus angka 1 sampai 5.' });
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: PILIHAN_AKUN,
    });

    if (!target) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }

    if (!bolehKelola(req.user, target)) {
      res.status(403).json({
        message: 'Hanya SUPERADMIN yang boleh mengatur perangkat akun ADMIN/SUPERADMIN.',
      });
      return;
    }

    if (target.maxDevices === batas) {
      res.status(200).json({ message: 'Batas perangkat tidak berubah.', maxDevices: batas });
      return;
    }

    await prisma.user.update({ where: { id: target.id }, data: { maxDevices: batas } });

    const nama = target.profile?.nama ?? target.nim;
    await logActivity(
      req.user.id,
      'DEVICE_LIMIT',
      'User',
      `Mengubah batas perangkat ${nama} dari ${target.maxDevices} menjadi ${batas}`,
      target.id
    );

    res.status(200).json({
      message: `${nama} sekarang boleh aktif di ${batas} perangkat sekaligus.`,
      maxDevices: batas,
    });
  } catch (error) { next(error); }
};
