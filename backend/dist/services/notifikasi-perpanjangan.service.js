"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cariPerpanjanganYangMauHabis = cariPerpanjanganYangMauHabis;
exports.kirimNotifikasiPerpanjangan = kirimNotifikasiPerpanjangan;
exports.pemeriksaanPerpanjanganHarian = pemeriksaanPerpanjanganHarian;
const prisma_1 = __importDefault(require("../lib/prisma"));
const email_service_1 = require("./email.service");
const audit_service_1 = require("./audit.service");
const notifikasi_perpanjangan_helper_1 = require("../lib/notifikasi-perpanjangan.helper");
/**
 * Notifikasi bila perpanjangan mau habis (30/7 hari sebelum akun dinonaktifkan).
 *
 * Dikumpulkan sekali sehari oleh job di index.ts (lihat notifikasiPerpanjanganHabis).
 * Email dikirim ke admin + menampilkan banner di dashboard.
 */
/** threshold dalam hari: beri tahu admin bila perpanjangan tinggal N hari lagi */
const PERTAHANAN_30_HARI = 30;
const PERTAHANAN_7_HARI = 7;
/**
 * Cari semua accounts yang akan berakhir dalam waktu dekat.
 * Mengembalikan daftar akun yang masih aktif TAPI perpanjanganHingga-nya
 * hampir tercapai (hanya tersisa 30 atau 7 hari).
 */
async function cariPerpanjanganYangMauHabis(hariSisa) {
    const sekarang = new Date();
    const batasTerdekat = new Date(sekarang.getTime() + hariSisa * 24 * 60 * 60 * 1000);
    const akun = await prisma_1.default.user.findMany({
        where: {
            isActive: true,
            role: 'MAHASISWA',
            perpanjanganHingga: {
                gte: sekarang,
                lte: batasTerdekat,
            },
        },
        include: {
            profile: {
                select: {
                    nama: true,
                    program_studi: true,
                    email: true,
                    no_hp: true,
                },
            },
        },
        orderBy: {
            perpanjanganHingga: 'asc',
        },
    });
    if (akun.length === 0)
        return [];
    return akun
        .map((a) => {
        if (!a.perpanjanganHingga)
            return null;
        const sisaHari = Math.floor((a.perpanjanganHingga.getTime() - sekarang.getTime()) / (24 * 60 * 60 * 1000));
        if (sisaHari < 0 || sisaHari > hariSisa)
            return null;
        return {
            id: a.id,
            nim: a.nim,
            nama: a.profile?.nama ?? null,
            program_studi: a.profile?.program_studi ?? '-',
            email: a.profile?.email ?? null,
            no_hp: a.profile?.no_hp ?? null,
            perpanjanganHingga: a.perpanjanganHingga ?? new Date(),
            sisaHari,
        };
    })
        .filter((a) => a !== null);
}
/**
 * Kirim email notifikasi ke admin tentang akun yang perpanjangan mau habis.
 */
async function kirimNotifikasiPerpanjangan(akunYangMauHabis, hariSisa) {
    if (akunYangMauHabis.length === 0)
        return;
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const listString = akunYangMauHabis
        .map((a) => {
        const nama = a.nama ?? a.nim;
        const tgl = a.perpanjanganHingga ? a.perpanjanganHingga.toLocaleDateString('id-ID') : '-';
        return `<li><strong>${nama}</strong> (${a.nim}) — ${a.program_studi} — Tinggal ${a.sisaHari} hari lagi (perpanjangan sampai ${tgl})</li>`;
    })
        .join('\n');
    const subject = `Peringatan: ${akunYangMauHabis.length} akun mahasiswa perpanjangan mau habis (${hariSisa} hari lagi)`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
      <h2 style="color: #333;">Peringatan Perpanjangan Mahasiswa</h2>
      <p>Ada <strong>${akunYangMauHabis.length} akun mahasiswa</strong> yang masa perpanjangannya akan segera habis dalam <strong>${hariSisa} hari</strong> ke depan.</p>
      <p>Silakan ikuti akun ini sebelum masa perpanjangannya berakhir:</p>
      <ul style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        ${listString}
      </ul>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        Notifikasi ini otomatis dikirim oleh sistem. Jika ada pertanyaan, hubungi administrator.
      </p>
    </div>
  `;
    if (adminEmail) {
        await (0, email_service_1.sendEmailNotification)(adminEmail, subject, html);
    }
    await (0, audit_service_1.logSystemActivity)('NOTIFICATION_PERPANJANGAN_HABIS', 'System', `Notifikasi otomatis: ${akunYangMauHabis.length} akun mahasiswa mendekati akhir masa perpanjangan (${hariSisa} hari lagi).`, undefined, {
        jumlahAkun: akunYangMauHabis.length,
        hariSisa,
        daftarNim: akunYangMauHabis.map((a) => a.nim),
    });
}
/**
 * Jalankan pemeriksaan dan kirim notifikasi bila ada akun yang perpanjangan mau habis.
 */
async function pemeriksaanPerpanjanganHarian() {
    // Gunakan helper untuk pengecekan utama dan kirim notifikasi
    const { checked } = await (0, notifikasi_perpanjangan_helper_1.checkAndNotifyExpiringExtensions)();
    // Sekarang lakukan pemeriksaan spesifik untuk 30 dan 7 hari
    const akun30Hari = await cariPerpanjanganYangMauHabis(PERTAHANAN_30_HARI);
    const akun7Hari = await cariPerpanjanganYangMauHabis(PERTAHANAN_7_HARI);
    if (akun30Hari.length > 0) {
        await kirimNotifikasiPerpanjangan(akun30Hari, PERTAHANAN_30_HARI);
    }
    if (akun7Hari.length > 0) {
        await kirimNotifikasiPerpanjangan(akun7Hari, PERTAHANAN_7_HARI);
    }
    return { '30_hari': akun30Hari.length, '7_hari': akun7Hari.length };
}
