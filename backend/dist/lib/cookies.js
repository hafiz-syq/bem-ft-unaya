"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.opsiHapusCookieToken = exports.opsiCookieToken = exports.isPermintaanHttps = exports.TOKEN_COOKIE = void 0;
/** Nama cookie sesi — dipakai untuk set, baca, dan hapus agar konsisten. */
exports.TOKEN_COOKIE = 'token';
const SEHARI_MS = 24 * 60 * 60 * 1000;
/**
 * Apakah permintaan ini benar-benar lewat HTTPS.
 *
 * Diperiksa dari koneksi langsung (req.secure) dan, bila ada, header
 * X-Forwarded-Proto dari reverse proxy. Jadi cookie hanya ditandai Secure
 * ketika transportnya memang terenkripsi.
 */
const isPermintaanHttps = (req) => {
    if (req.secure)
        return true;
    const forwarded = req.get('x-forwarded-proto');
    if (forwarded)
        return forwarded.split(',')[0].trim().toLowerCase() === 'https';
    return false;
};
exports.isPermintaanHttps = isPermintaanHttps;
/**
 * Opsi cookie sesi.
 *
 * Sebelumnya flag Secure mengikuti NODE_ENV === 'production'. Akibatnya, begitu
 * backend dijalankan sebagai produksi tapi diakses lewat HTTP biasa (mis. server
 * kampus yang dibuka dari HP via http://192.168.x.x), browser membuang cookie
 * Secure tersebut dan pengguna terjebak di halaman login tanpa pesan error.
 * Sekarang keputusannya mengikuti protokol permintaan yang sebenarnya.
 */
const opsiCookieToken = (req) => ({
    httpOnly: true,
    secure: (0, exports.isPermintaanHttps)(req),
    sameSite: 'lax',
    maxAge: SEHARI_MS,
});
exports.opsiCookieToken = opsiCookieToken;
/** Opsi untuk menghapus cookie. Tanpa maxAge agar browser langsung membuangnya. */
const opsiHapusCookieToken = (req) => ({
    httpOnly: true,
    secure: (0, exports.isPermintaanHttps)(req),
    sameSite: 'lax',
});
exports.opsiHapusCookieToken = opsiHapusCookieToken;
