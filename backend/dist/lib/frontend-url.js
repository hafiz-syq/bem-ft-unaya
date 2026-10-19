"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.samarkanEmail = exports.frontendBaseUrl = void 0;
/**
 * Alamat dasar web frontend, dipakai untuk menyusun tautan di dalam email
 * (mis. tautan reset password).
 *
 * FRONTEND_URL berisi satu alamat; FRONTEND_URLS boleh berisi beberapa alamat
 * dipisah koma. Yang dipakai adalah alamat PERTAMA, karena itulah alamat resmi
 * yang dibuka pengguna. Tanpa konfigurasi, alamat pengembangan lokal dipakai.
 */
const frontendBaseUrl = () => {
    const mentah = process.env.FRONTEND_URL || process.env.FRONTEND_URLS || 'http://localhost:5173';
    const pertama = mentah.split(',')[0].trim();
    return pertama.replace(/\/+$/, '') || 'http://localhost:5173';
};
exports.frontendBaseUrl = frontendBaseUrl;
/** Menyembunyikan sebagian alamat email untuk ditampilkan ke pengguna. */
const samarkanEmail = (email) => {
    const [nama, domain] = email.split('@');
    if (!nama || !domain)
        return email;
    const terlihat = nama.slice(0, Math.min(2, nama.length));
    return `${terlihat}${'*'.repeat(Math.max(3, nama.length - 2))}@${domain}`;
};
exports.samarkanEmail = samarkanEmail;
