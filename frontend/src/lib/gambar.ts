import { assetUrl } from './axios';

/**
 * URL foto profil yang sudah diperkecil di sisi Cloudinary.
 *
 * Foto asli hasil unggah bisa 1000 px lebih, sedangkan avatar dirender
 * 24–96 px. Tanpa transformasi, browser mengunduh gambar penuh — pada
 * Lighthouse ini terukur puluhan KB per avatar. Cloudinary mendukung
 * transformasi di path (`/image/upload/w_80,h_80,c_fill,q_auto,f_auto/...`),
 * jadi ukurannya cukup disisipkan sebelum segmen versi.
 *
 * Foto lama yang masih berupa path `/uploads/...` atau URL non-Cloudinary
 * dikembalikan apa adanya lewat `assetUrl`.
 *
 * `px` adalah ukuran tampil dalam CSS piksel; nilainya dikalikan dua di sini
 * supaya avatar tetap tajam di layar berkerapatan tinggi.
 */
export const avatarUrl = (foto: string | null | undefined, px: number): string => {
  const dasar = assetUrl(foto);
  if (!dasar) return '';

  if (!/^https:\/\/res\.cloudinary\.com\//i.test(dasar)) return dasar;

  const penanda = '/image/upload/';
  const posisi = dasar.indexOf(penanda);
  if (posisi === -1) return dasar;

  const sesudahPenanda = dasar.slice(posisi + penanda.length);

  // Jangan menumpuk transformasi bila URL sudah membawa lebar sendiri.
  if (/^w_\d+/.test(sesudahPenanda)) return dasar;

  const ukuran = Math.max(48, Math.min(512, Math.round(px * 2)));
  const transformasi = `w_${ukuran},h_${ukuran},c_fill,q_auto,f_auto`;

  return `${dasar.slice(0, posisi + penanda.length)}${transformasi}/${sesudahPenanda}`;
};
