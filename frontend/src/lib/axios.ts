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
  (import.meta.env.PROD
    ? // Build produksi tanpa VITE_API_URL memakai origin yang sama. Ini pola
      // deploy Hostinger: satu domain menyajikan SPA, API, dan /uploads.
      '/api'
    : typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000/api`
      : 'http://localhost:3000/api');

// --- Identitas perangkat -----------------------------------------------
// ID acak disimpan di localStorage dan dikirim pada setiap permintaan. Backend
// memakainya untuk mengunci akun ke satu perangkat. Nilainya bukan sidik jari
// browser; hanya pembeda perangkat yang stabil selama penyimpanan tidak dihapus.
const KUNCI_PERANGKAT = 'bem-ft-id-perangkat';

const buatIdPerangkat = (): string => {
  try {
    const tersimpan = localStorage.getItem(KUNCI_PERANGKAT);
    if (tersimpan && /^[A-Za-z0-9_-]{8,64}$/.test(tersimpan)) return tersimpan;

    const baru = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    localStorage.setItem(KUNCI_PERANGKAT, baru);
    return baru;
  } catch {
    // Penyimpanan diblokir (mode privat ketat). Jangan membuat ID sementara:
    // ID yang berubah setiap muat halaman akan mengunci pengguna dari akunnya
    // sendiri. Tanpa header, akun baru tetap bisa dipakai dan baru akan terikat
    // saat pengguna membuka aplikasi di browser yang mengizinkan localStorage.
    return '';
  }
};

export const ID_PERANGKAT = buatIdPerangkat();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (ID_PERANGKAT) config.headers.set('X-Device-Id', ID_PERANGKAT);
  return config;
});

/** Akar server (tanpa /api), dipakai untuk membentuk URL berkas unggahan. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Mengubah path berkas dari backend (mis. /uploads/foto.jpg) menjadi URL lengkap. */
export const assetUrl = (path?: string | null): string =>
  path ? `${API_ORIGIN}${path}` : '';
