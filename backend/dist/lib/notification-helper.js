"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExtensionExpiryWarning = sendExtensionExpiryWarning;
exports.checkAndNotifyExpiringExtensions = checkAndNotifyExpiringExtensions;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("./prisma"));
function getTransporter() {
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}
async function sendExtensionExpiryWarning(to, userName, studentNim, expiredAt, daysLeft) {
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"BEM FT UNAYA" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `Peringatan: Perpanjangan masa studi ${daysLeft} hari lagi`,
        html: `
      <h1>Perpanjangan Masa Studi Akan Habis</h1>
      <p>Halo ${userName},</p>
      <p>Akun mahasiswa dengan NIM ${studentNim} akan dinonaktifkan dalam <strong>${daysLeft} hari</strong> karena masa perpanjangan studi akan berakhir pada <strong>${new Date(expiredAt).toLocaleDateString('id-ID')}</strong>.</p>
      <p>Segera hubungi administrator untuk memperpanjangkan masa studi Anda.</p>
      <hr>
      <p><em>Email ini dikirim secara otomatis oleh sistem BEM-FT UNAYA.</em></p>
    `,
    });
}
async function checkAndNotifyExpiringExtensions() {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const admins = await prisma_1.default.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
        include: { profile: true },
    });
    const expiringStudents = await prisma_1.default.user.findMany({
        where: {
            role: 'MAHASISWA',
            isActive: true,
            perpanjanganHingga: {
                lte: thirtyDaysLater,
                gt: now,
            },
        },
        include: { profile: true },
        orderBy: { perpanjanganHingga: 'asc' },
    });
    for (const student of expiringStudents) {
        const expiredAt = student.perpanjanganHingga;
        const daysLeft = Math.ceil((expiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (student.profile?.email) {
            try {
                await sendExtensionExpiryWarning(student.profile.email, student.profile.nama || 'Mahasiswa', student.nim, expiredAt.toISOString(), daysLeft);
            }
            catch (err) {
                console.error(`Gagal kirim email ke ${student.profile.email}:`, err);
            }
        }
        const message = `Perpanjangan masa studi ${student.profile?.nama || student.nim} (${student.nim}) akan berakhir dalam ${daysLeft} hari (${expiredAt.toLocaleDateString('id-ID')}).`;
        for (const admin of admins) {
            await prisma_1.default.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Peringatan Perpanjangan Studi',
                    message,
                    isRead: false,
                },
            });
        }
    }
    return { checked: expiringStudents.length };
}
