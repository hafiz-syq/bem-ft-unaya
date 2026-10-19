"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kelolaPerangkat = exports.getPerangkat = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("../services/audit.service");
const ticket_access_1 = require("../lib/ticket-access");
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
    profile: { select: { nama: true, program_studi: true } },
};
/** ADMIN tidak boleh mengelola akun pengelola lain; hanya SUPERADMIN yang boleh. */
const bolehKelola = (aktor, target) => {
    if (aktor.id === target.id)
        return true;
    if (!(0, ticket_access_1.isAdminRole)(target.role))
        return true;
    return aktor.role === 'SUPERADMIN';
};
const getPerangkat = async (req, res, next) => {
    try {
        const halaman = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const batas = Math.min(50, Math.max(5, parseInt(String(req.query.limit ?? '20'), 10) || 20));
        const cari = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'SEMUA';
        const where = {};
        if (cari) {
            where.OR = [
                { nim: { contains: cari } },
                { profile: { is: { nama: { contains: cari } } } },
            ];
        }
        if (status === 'TERIKAT')
            where.deviceId = { not: null };
        else if (status === 'MENUNGGU')
            where.pendingDeviceId = { not: null };
        else if (status === 'BEBAS')
            where.deviceId = null;
        const [akun, total, terikat, menunggu, bebas] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                select: PILIHAN_AKUN,
                orderBy: { nim: 'asc' },
                skip: (halaman - 1) * batas,
                take: batas,
            }),
            prisma_1.default.user.count({ where }),
            prisma_1.default.user.count({ where: { deviceId: { not: null } } }),
            prisma_1.default.user.count({ where: { pendingDeviceId: { not: null } } }),
            prisma_1.default.user.count({ where: { deviceId: null } }),
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
    }
    catch (error) {
        next(error);
    }
};
exports.getPerangkat = getPerangkat;
const kelolaPerangkat = async (req, res, next) => {
    try {
        const mode = String(req.body?.mode ?? 'LEPAS').toUpperCase();
        if (!['IZINKAN', 'LEPAS', 'TOLAK'].includes(mode)) {
            res.status(400).json({ message: 'Mode pengelolaan perangkat tidak dikenal.' });
            return;
        }
        const target = await prisma_1.default.user.findUnique({
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
            await prisma_1.default.user.update({
                where: { id: target.id },
                data: { pendingDeviceId: null, pendingDeviceLabel: null, pendingDeviceAt: null },
            });
            await (0, audit_service_1.logActivity)(req.user.id, 'DEVICE_REJECT', 'User', `Menolak percobaan login perangkat baru (${target.pendingDeviceLabel ?? 'perangkat tidak dikenal'}) untuk ${nama}`, target.id);
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
            await prisma_1.default.user.update({
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
            await (0, audit_service_1.logActivity)(req.user.id, 'DEVICE_ALLOW', 'User', `Mengizinkan perangkat baru (${target.pendingDeviceLabel ?? 'perangkat tidak dikenal'}) untuk ${nama}`, target.id);
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
        await prisma_1.default.user.update({
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
        });
        await (0, audit_service_1.logActivity)(req.user.id, 'DEVICE_RESET', 'User', `Membuka kunci perangkat untuk ${nama}`, target.id);
        res.status(200).json({
            message: `Kunci perangkat ${nama} dibuka. Pengguna dapat login di perangkat mana pun; sesi lama otomatis berakhir.`,
            perluLoginUlang: diriSendiri,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.kelolaPerangkat = kelolaPerangkat;
