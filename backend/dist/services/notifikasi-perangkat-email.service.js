"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kirimEmailNotifikasiPerangkatBaru = exports.KIRIM_EMAIL_PERANGKAT_BARU = void 0;
const email_service_1 = require("./email.service");
/**
 * Saluran email untuk notifikasi percobaan login perangkat baru.
 *
 * Dipanggil bersamaan dengan notifikasi in-app (beriNotifikasiPercobaanPerangkat)
 * agar admin dapat pemberitahuan melalui dua saluran sekaligus:
 * - in-app: notifikasi masuk di halaman Perangkat & Sesi
 * - email:  panggilan ke SMTP yang sudah dikonfigurasi di .env
 *
 * Email dikirim ke SEMUA admin/SUPERADMIN yang terdaftar di sistem.
 * Jika SMTP gagal (mis. kredensial belum diisi atau jaringan bermasalah),
 * fungsi ini hanya memuat error ke console dan TIDAK melempar — supaya
 * kegagalan email tidak mengganggu alur login yang sudah berjalan.
 */
const SUBJECT_PERANGKAT_BARU = '[BEM-FT UNAYA] Ada percobaan login perangkat baru';
exports.KIRIM_EMAIL_PERANGKAT_BARU = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const kirimEmailNotifikasiPerangkatBaru = async (admins, targetNim) => {
    if (!exports.KIRIM_EMAIL_PERANGKAT_BARU)
        return;
    const penerima = admins
        .map((a) => (a.email ? a.email.toLowerCase() : null))
        .filter((e) => Boolean(e));
    if (penerima.length === 0)
        return;
    const html = `
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
        .box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .label { font-size: 11px; text-transform: uppercase; color: #b45309; font-weight: 700; letter-spacing: 0.5px; }
        .value { font-size: 15px; font-weight: 600; color: #92400e; margin-top: 4px; word-break: break-word; }
        .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🖥️ Percobaan Perangkat Baru</h1>
          <p>BEM-FT UNAYA • Portal Resmi Mahasiswa</p>
        </div>
        <div class="content">
          <p>Halo,</p>
          <p style="color: #4b5563; line-height: 1.6;">
            Terdapat akun yang mencoba login dari perangkat baru dan menunggu persetujuan admin.
          </p>
          <div class="box">
            <div class="label">Akun yang tercurigai</div>
            <div class="value">NIM: ${targetNim}</div>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            Silakan login ke dashboard dan buka menu <strong>Perangkat &amp; Sesi</strong>
            untuk mengizinkan atau menolak perangkat tersebut.
          </p>
        </div>
        <div class="footer">
          <p>© 2026 BEM-FT UNAYA. Semua hak dilindungi.</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();
    await (0, email_service_1.sendEmailNotification)(penerima, SUBJECT_PERANGKAT_BARU, html);
};
exports.kirimEmailNotifikasiPerangkatBaru = kirimEmailNotifikasiPerangkatBaru;
