import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { kirimPushKeBanyak } from '../services/push.service';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendExtensionExpiryWarning(
  to: string,
  userName: string,
  studentNim: string,
  expiredAt: string,
  daysLeft: number
) {
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

export async function checkAndNotifyExpiringExtensions() {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
    include: { profile: true },
  });

  const expiringStudents = await prisma.user.findMany({
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

  const idAdmins = admins.map((a) => a.id);
  const pesan: string[] = [];

  for (const student of expiringStudents) {
    const expiredAt = student.perpanjanganHingga!;
    const daysLeft = Math.ceil(
      (expiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (student.profile?.email) {
      try {
        await sendExtensionExpiryWarning(
          student.profile.email,
          student.profile.nama || 'Mahasiswa',
          student.nim,
          expiredAt.toISOString(),
          daysLeft
        );
      } catch (err) {
        console.error(`Gagal kirim email ke ${student.profile.email}:`, err);
      }
    }

    const message = `Perpanjangan masa studi ${student.profile?.nama || student.nim} (${student.nim}) akan berakhir dalam ${daysLeft} hari (${expiredAt.toLocaleDateString('id-ID')}).`;
    pesan.push(message);

    // Push per mahasiswa, bukan per pasangan mahasiswa×admin: isinya berbeda
    // tiap mahasiswa, jadi satu panggilan mengirim ke semua admin sekaligus.
    await kirimPushKeBanyak(idAdmins, {
      title: 'Peringatan Perpanjangan Studi',
      body: message,
      url: '/students',
    }).catch(() => undefined);
  }

  // Satu INSERT untuk semua baris, menggantikan satu INSERT per admin per
  // mahasiswa. Email tetap di luarnya supaya percobaan ulang koneksi SMTP
  // tidak menahan transaksi.
  if (idAdmins.length > 0 && pesan.length > 0) {
    await prisma.notification.createMany({
      data: pesan.flatMap((message) =>
        idAdmins.map((userId) => ({
          userId,
          title: 'Peringatan Perpanjangan Studi',
          message,
          isRead: false,
        }))
      ),
    });
  }

  return { checked: expiringStudents.length };
}
