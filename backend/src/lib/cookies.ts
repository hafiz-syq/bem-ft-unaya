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
export const isPermintaanHttps = (req: Request): boolean => {
  if (req.secure) return true;

  const forwarded = req.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';

  return false;
};

/**
 * Opsi cookie sesi.
 *
 * Sebelumnya flag Secure mengikuti NODE_ENV === 'production'. Akibatnya, begitu
 * backend dijalankan sebagai produksi tapi diakses lewat HTTP biasa (mis. server
 * kampus yang dibuka dari HP via http://192.168.x.x), browser membuang cookie
 * Secure tersebut dan pengguna terjebak di halaman login tanpa pesan error.
 * Sekarang keputusannya mengikuti protokol permintaan yang sebenarnya.
 */
export const opsiCookieToken = (req: Request): CookieOptions => ({
  httpOnly: true,
  secure: isPermintaanHttps(req),
  sameSite: 'lax',
  maxAge: SEHARI_MS,
});

/** Opsi untuk menghapus cookie. Tanpa maxAge agar browser langsung membuangnya. */
export const opsiHapusCookieToken = (req: Request): CookieOptions => ({
  httpOnly: true,
  secure: isPermintaanHttps(req),
  sameSite: 'lax',
});
