/**
 * Peringatan backup gagal lewat email.
 *
 * Dipanggil oleh scripts\backup-database.bat saat dump gagal:
 *   node backend\scripts\peringatan-backup.cjs GAGAL "D:\...\bem_ft_unaya_XXX.sql"
 *
 * Semua data koneksi dibaca dari backend/.env lewat dotenv, sama seperti
 * services/email.service.ts, sehingga tidak ada kredensial di skrip ini.
 *
 * Penerima: variabel lingkungan ALERT_EMAIL kalau disetel (satu alamat).
 * Tanpa ALERT_EMAIL, kirim ke alamat SMTP_USER (akun pengirim itu sendiri).
 *
 * Selalu exit 0 walau pengiriman gagal: skrip backup yang memanggilnya tidak
 * boleh ikut "gagal" lebih dalam karena pemberitahuan itu sendiri tersendat.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nilai pertama dari daftar yang benar-benar berformat alamat email. */
const alamatEmail = (...kandidat) =>
  kandidat.map((k) => String(k ?? '').trim()).find((v) => POLA_EMAIL.test(v)) || '';

function utama() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS;

  // SMTP_FROM di .env bisa hanya nama pengirim (mis. "BEM-FT UNAYA"), bukan
  // alamat. Hanya pakai sebagai alamat bila berformat email; akun pengirim
  // (SMTP_USER) selalu valid karena dipakai untuk login SMTP.
  const alamatKirim = alamatEmail(process.env.SMTP_USER, process.env.SMTP_FROM);
  const penerima = String(process.env.ALERT_EMAIL || '').trim() || alamatKirim;

  if (!host || !user || !pass) {
    console.log('SMTP belum lengkap di .env — peringatan email dilewati.');
    return; // Jangan gagalkan: hanya tidak bisa memberi tahu.
  }
  if (!penerima) {
    console.log('Tidak ada alamat penerima (setel ALERT_EMAIL) — peringatan dilewati.');
    return;
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  const statusArg = String(process.argv[2] || 'GAGAL').toUpperCase();
  const berkasArg = String(process.argv[3] || '').trim();

  const subjek =
    statusArg === 'GAGAL'
      ? `[PERINGATAN] Backup bem_ft_unaya GAGAL — ${new Date().toLocaleString('id-ID')}`
      : `[INFO] Backup bem_ft_unaya ${statusArg} — ${new Date().toLocaleString('id-ID')}`;

  const isi = [
    `Status backup: ${statusArg}`,
    berkasArg ? `Berkas target: ${berkasArg}` : 'Berkas target: (tidak diberikan)',
    '',
    'Periksa log lengkap di:',
    '  D:\\Coding Apis\\bem-ft-unaya\\backups\\backup.log',
    '',
    'Pengirim otomatis: scripts\\backup-database.bat + backend\\scripts\\peringatan-backup.cjs',
  ].join('\n');

  transporter
    .sendMail({ from: `"BEM-FT UNAYA" <${penerima}>`, to: penerima, subject: subjek, text: isi })
    .then((info) => {
      console.log(`Email peringatan terkirim ke ${penerima} (${info.messageId || 'tanpa id'}).`);
    })
    .catch((gagal) => {
      console.error(`Gagal mengirim email peringatan: ${gagal && gagal.message ? gagal.message : gagal}`);
    });
}

utama();
