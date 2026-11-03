import type { CookieOptions, Request } from 'express';

/** Nama cookie sesi — dipakai untuk set, baca, dan hapus agar konsisten. */
export const TOKEN_COOKIE = 'token';

const SEHARI_MS = 24 * 60 * 60 * 1000;

/**
 * Apakah permintaan ini benar-benar lewat HTTPS.
 *
 * Diperiksa dari koneksi langsung (req.secure) dan, bila ada, header
 * X-Forwarded-Proto dari reverse proxy. Jadi cookie hanya ditandai Secure
 * ketika transportnya memang terenkripsi.
 */
const isPermintaanHttps = (req: Request): boolean => {
  if (req.secure) return true;

  const forwarded = req.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';

  return false;
};

/**
 * Apakah cookie boleh diawali tanpa Secure.
 *
 * VERCEL_ENV (production & preview) hanya dilayani lewat HTTPS, jadi keputusannya
 * dipaksa aman di sana dan tidak lagi bergantung pada X-Forwarded-Proto — header
 * itu bisa tidak terkirim atau dipalsukan pembuat permintaan. Di luar Vercel
 * (mis. server kampus yang dibuka via http://192.168.x.x) Secure tetap mengikuti
 * protokol permintaan sebenarnya: memaksanya membuat browser membuang cookie dan
 * pengguna terjebak di halaman login tanpa pesan.
 */
export const cookieHarusSecure = (req: Request): boolean =>
  Boolean(process.env.VERCEL_ENV) || isPermintaanHttps(req);

/**
 * Nilai SameSite untuk cookie sesi.
 *
 * Default `lax` (aman untuk aplikasi satu situs, termasuk frontend di
 * app.domain dan API di api.domain). Bila frontend dan API benar-benar berada
 * di situs berbeda (mis. frontend di penyedia statis dan API di domain lain),
 * setel `COOKIE_SAME_SITE=none`, karena cookie `lax` TIDAK ikut terkirim pada
 * permintaan lintas situs dan pengguna akan terjebak di halaman login.
 *
 * `none` mewajibkan Secure; nilainya dipaksa di opsiCookieToken di bawah.
 */
const sameSiteCookie = (): CookieOptions['sameSite'] => {
  const nilai = (process.env.COOKIE_SAME_SITE || 'lax').trim().toLowerCase();
  if (nilai === 'none' || nilai === 'strict') return nilai;
  return 'lax';
};

/**
 * Opsi cookie sesi.
 *
 * Sebelumnya flag Secure mengikuti NODE_ENV === 'production'. Akibatnya, begitu
 * backend dijalankan sebagai produksi tapi diakses lewat HTTP biasa (mis. server
 * kampus yang dibuka dari HP via http://192.168.x.x), browser membuang cookie
 * Secure tersebut dan pengguna terjebak di halaman login tanpa pesan error.
 * Sekarang keputusannya mengikuti protokol permintaan yang sebenarnya, dan
 * otomatis dipaksa Secure bila SameSite=None (syarat browser).
 */
export const opsiCookieToken = (req: Request): CookieOptions => {
  const sameSite = sameSiteCookie();
  return {
    httpOnly: true,
    secure: sameSite === 'none' || cookieHarusSecure(req),
    sameSite,
    maxAge: SEHARI_MS,
  };
};

/** Opsi untuk menghapus cookie. Tanpa maxAge agar browser langsung membuangnya. */
export const opsiHapusCookieToken = (req: Request): CookieOptions => {
  const sameSite = sameSiteCookie();
  return {
    httpOnly: true,
    secure: sameSite === 'none' || cookieHarusSecure(req),
    sameSite,
  };
};
