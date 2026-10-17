import axios from 'axios';

/**
 * Satu-satunya tempat alamat backend ditentukan.
 *
 * Secara bawaan alamatnya mengikuti host yang dipakai membuka aplikasi, jadi:
 * - dibuka di http://localhost:5173  -> backend http://localhost:3000
 * - dibuka di http://192.168.x.x:5173 -> backend http://192.168.x.x:3000
 * Dengan begitu aplikasi tetap jalan baik dari komputer sendiri maupun dari
 * perangkat lain di jaringan yang sama, tanpa mengubah kode.
 *
 * Untuk produksi, setel VITE_API_URL (mis. https://api.contoh.com/api).
 */
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

/** Akar server (tanpa /api), dipakai untuk membentuk URL berkas unggahan. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Mengubah path berkas dari backend (mis. /uploads/foto.jpg) menjadi URL lengkap. */
export const assetUrl = (path?: string | null): string =>
  path ? `${API_ORIGIN}${path}` : '';
