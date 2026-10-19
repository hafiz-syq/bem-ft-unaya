"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.beriNotifikasiPercobaanPerangkat = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const audit_service_1 = require("./audit.service");
const notifikasi_perangkat_email_service_1 = require("./notifikasi-perangkat-email.service");
/**
 * Notifikasi atas percobaan login dari perangkat baru.
 *
 * Saat login ditolak karena perangkat lain, admin punya dua saluran:
 * - in-app: notifikasi masuk di halaman Perangkat & Sesi (filter "Menunggu")
 * - email:  kiriman SMTP ke seluruh admin/SUPERADMIN (jika SMTP terisi di .env)
 *
 * Notifikasi hanya dibuat sekali per percobaan — tidak dibuat ulang tiap
 * login yang gagal, supaya tidak spam dan supaya admin tahu ada yang baru.
 */
const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];
/**
 * Catat notifikasi in-app ke seluruh ADMIN/SUPERADMIN dan kirim salinan email
 * bila SMTP sudah dikonfigurasi, untuk percobaan perangkat baru yang belum
 * pernah diberitahu sebelumnya.
 *
 * Dipakai pada fungsi login, tepat setelah `pendingDeviceId` berhasil
 * disimpan dan sebelum balasan 403 kembali ke klien.
 */
const beriNotifikasiPercobaanPerangkat = async (targetId, aktorId, targetNim) => {
    // Cek apakah percobaan ini sudah pernah memicu notifikasi sebelumnya.
    // Batas 1 notifikasi per percobaan — tidak spam.
    const terakhir = await prisma_1.default.auditLog.findFirst({
        where: {
            action: 'NOTIF_PERANGKAT_BARU',
            metadata: {
                path: ['entityId'],
                equals: targetId,
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    if (terakhir)
        return; // sudah diagkui
    const admins = await prisma_1.default.user.findMany({
        where: { role: { in: [...ADMIN_ROLES] } },
        select: { id: true, nim: true, email: true },
    });
    const judul = 'Ada percobaan login perangkat baru';
    const pesanMudah = 'Ada akun yang mencoba login dari perangkat lain. Cek menu Perangkat & Sesi.';
    await prisma_1.default.notification.createMany({
        data: admins.map((admin) => ({
            userId: admin.id,
            title: judul,
            message: pesanMudah,
            isRead: false,
            createdAt: new Date(),
        })),
        skipDuplicates: true,
    });
    const dataEmail = admins.map((a) => ({ nim: a.nim, email: a.email }));
    (0, notifikasi_perangkat_email_service_1.kirimEmailNotifikasiPerangkatBaru)(dataEmail, targetNim).catch((err) => {
        console.error('[notif-perangkat-email] gagal kirim email:', err);
    });
    // Catat bahwa kita sudah memberi tahu – supaya tak berulang.
    await (0, audit_service_1.logActivity)(aktorId, 'NOTIF_PERANGKAT_BARU', 'System', `Notifikasi percobaan perangkat baru dibuat untuk ${admins.length} admin.`, targetId, {
        notifCount: admins.length,
        notifiedAt: new Date().toISOString(),
    });
};
exports.beriNotifikasiPercobaanPerangkat = beriNotifikasiPercobaanPerangkat;
