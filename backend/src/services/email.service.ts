import nodemailer from 'nodemailer';

// Konfigurasi Transporter SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true untuk 465, false untuk 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Password App (khusus Gmail, bukan password biasa)
  },
});

/**
 * Kirim email notifikasi ke satu atau lebih penerima
 */
export async function sendEmailNotification(
  to: string | string[],
  subject: string,
  htmlContent: string
): Promise<void> {
  const mailOptions = {
    from: `"BEM-FT UNAYA" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email notification sent: "${subject}" to ${Array.isArray(to) ? to.length : 1} recipient(s)`);

  } catch (error) {
    console.error('❌ Gagal mengirim email notification:', error);
    // Jangan throw error biar tidak ganggu flow utama
  }
}

/**
 * Kirim kode verifikasi email.
 * Berbeda dari sendEmailNotification, fungsi ini MENGEMBALIKAN status pengiriman
 * supaya pemanggil bisa memberi tahu pengguna kalau email gagal terkirim
 * (pengguna akan terjebak di halaman verifikasi kalau ini gagal).
 */
export async function sendVerificationEmail(
  to: string,
  recipientName: string,
  code: string,
  ttlMinutes: number
): Promise<boolean> {
  const mailOptions = {
    from: `"BEM-FT UNAYA" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `🔐 ${code} adalah kode verifikasi email Anda`,
    html: generateEmailVerificationEmail(recipientName, code, ttlMinutes),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // Kode sengaja TIDAK dicatat di log
    console.log(`✅ Kode verifikasi email dikirim ke ${to} (id: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('❌ Gagal mengirim kode verifikasi email:', error);
    return false;
  }
}

/**
 * Template email berisi kode verifikasi
 */
export function generateEmailVerificationEmail(
  recipientName: string,
  code: string,
  ttlMinutes: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 24px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; }
        .header p { color: #fef3c7; margin: 5px 0 0 0; font-size: 13px; }
        .content { padding: 24px; }
        .code-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #92400e; margin: 0; }
        .code-label { font-size: 12px; text-transform: uppercase; color: #b45309; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 8px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Verifikasi Email</h1>
          <p>BEM-FT UNAYA • Portal Resmi Mahasiswa</p>
        </div>
        <div class="content">
          <p>Halo <strong>${recipientName}</strong>,</p>
          <p style="color: #4b5563; line-height: 1.6;">
            Masukkan kode di bawah ini untuk memverifikasi alamat email Anda.
            Setelah terverifikasi, notifikasi resmi dari portal akan dikirim ke alamat ini.
          </p>

          <div class="code-box">
            <div class="code-label">Kode Verifikasi</div>
            <p class="code">${code}</p>
          </div>

          <p style="color: #6b7280; font-size: 13px;">
            Kode ini berlaku selama <strong>${ttlMinutes} menit</strong>.
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            Kalau Anda tidak merasa mendaftarkan alamat ini, cukup abaikan email ini.
            Jangan berikan kode ini kepada siapa pun.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 BEM-FT UNAYA. Semua hak dilindungi.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Kirim kode OTP + tautan reset password.
 * Berbeda dari sendEmailNotification, fungsi ini mengembalikan status supaya
 * pengguna tahu kalau email tidak terkirim (tanpa itu, ia akan menunggu kode
 * yang tidak pernah datang).
 */
export async function sendPasswordResetEmail(
  to: string,
  recipientName: string,
  code: string,
  link: string,
  ttlMinutes: number
): Promise<boolean> {
  const mailOptions = {
    from: `"BEM-FT UNAYA" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `🔑 ${code} adalah kode reset password Anda`,
    html: generatePasswordResetEmail(recipientName, code, link, ttlMinutes),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // Kode & tautan sengaja TIDAK dicatat di log.
    console.log(`✅ Kode reset password dikirim ke ${to} (id: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('❌ Gagal mengirim kode reset password:', error);
    return false;
  }
}

/**
 * Template email berisi kode OTP dan tautan reset password.
 * Tautan membawa token sekali pakai, jadi pengguna bisa langsung membuka form
 * password baru tanpa mengetik kode.
 */
export function generatePasswordResetEmail(
  recipientName: string,
  code: string,
  link: string,
  ttlMinutes: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 24px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; }
        .header p { color: #fef3c7; margin: 5px 0 0 0; font-size: 13px; }
        .content { padding: 24px; }
        .code-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-family: 'Courier New', monospace; font-size: 34px; font-weight: 700; letter-spacing: 9px; color: #92400e; margin: 0; }
        .code-label { font-size: 12px; text-transform: uppercase; color: #b45309; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 8px; }
        .btn { display: inline-block; padding: 12px 22px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 Reset Password</h1>
          <p>BEM-FT UNAYA • Portal Resmi Mahasiswa</p>
        </div>
        <div class="content">
          <p>Halo <strong>${recipientName}</strong>,</p>
          <p style="color: #4b5563; line-height: 1.6;">
            Kami menerima permintaan untuk mengatur ulang password akun portal Anda.
            Masukkan kode di bawah ini pada halaman lupa password, atau klik tombol
            di bawah untuk langsung membuka form password baru.
          </p>

          <div class="code-box">
            <div class="code-label">Kode OTP</div>
            <p class="code">${code}</p>
          </div>

          <p style="text-align: center; margin: 24px 0;">
            <a class="btn" href="${link}">Buat Password Baru</a>
          </p>

          <p style="color: #6b7280; font-size: 13px;">
            Kode berlaku <strong>${ttlMinutes} menit</strong> dan tautan di atas hanya bisa dipakai sekali.
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            Kalau Anda tidak meminta reset password, abaikan email ini — password lama Anda tetap berlaku.
            Jangan berikan kode ini kepada siapa pun.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 BEM-FT UNAYA. Semua hak dilindungi.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template email untuk notifikasi tiket baru masuk
 */
export function generateTicketNotificationEmail(
  recipientName: string,
  ticketNo: string,
  ticketType: string,
  ticketTitle: string,
  senderNim: string,
  senderCategory: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 24px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; }
        .header p { color: #fef3c7; margin: 5px 0 0 0; font-size: 13px; }
        .content { padding: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1d4ed8; margin-bottom: 12px; }
        .ticket-no { font-family: monospace; font-size: 13px; color: #6b7280; margin-bottom: 8px; }
        .title { font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 16px; line-height: 1.4; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .info-item { background: #f9fafb; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .info-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; font-weight: 600; letter-spacing: 0.5px; }
        .info-value { font-size: 14px; font-weight: 600; color: #374151; margin-top: 4px; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .btn { display: inline-block; padding: 10px 20px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 10px; }
        .footer a { color: #f59e0b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 Tiket Baru Masuk</h1>
          <p>BEM-FT UNAYA • Portal Resmi Mahasiswa</p>
        </div>
        <div class="content">
          <p>Halo <strong>${recipientName}</strong>,</p>
          <p style="color: #4b5563; line-height: 1.6;">
            Ada aspirasi/keluhan baru yang masuk melalui portal BEM-FT UNAYA.
            Tolong tinjau dan proses sesuai prosedur.
          </p>

          <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 16px 0;">
            <span class="badge">Tiket Baru</span>
            <div class="ticket-no">${ticketNo}</div>
            <div class="title">${ticketTitle}</div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Tipe</div>
              <div class="info-value">${ticketType}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Kategori</div>
              <div class="info-value">${senderCategory}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Pengirim (NIM)</div>
              <div class="info-value">${senderNim}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value" style="color: #f59e0b;">⏳ Menunggu Tinjauan</div>
            </div>
          </div>

          <p style="color: #6b7280; font-size: 13px;">
            Silakan login ke dashboard untuk melihat detail dan memproses tiket ini.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 BEM-FT UNAYA. Semua hak dilindungi.</p>
          <p style="margin-top: 8px;">jika ini bukan yang kamu harapkan, abaikan email ini.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
