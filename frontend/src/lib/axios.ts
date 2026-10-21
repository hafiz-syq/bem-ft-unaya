import axios from 'axios';

/**
 * Satu-satunya tempat alamat backend ditentukan.
 *
 * Semua permintaan memakai path relatif '/api', tanpa host absolut. Dengan
 * begitu aplikasi bekerja di origin mana pun (Hostinger, Vercel, atau IP LAN)
 * karena SPA dan API disajikan dari domain yang sama.
 *
 * Saat `npm run dev`, Vite mem-proxy '/api' dan '/uploads' ke backend lokal
 * port 3000 (lihat vite.config.ts).
 */
const API_BASE_URL = '/api';

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
