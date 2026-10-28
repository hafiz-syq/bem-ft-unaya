import axios, { type InternalAxiosRequestConfig } from 'axios';

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

/** Permintaan yang sedang diputar ulang dari antrean offline tidak boleh diantrekan lagi. */
const dariAntrean = (config?: InternalAxiosRequestConfig): boolean => {
  if (!config) return false;
  const headers = config.headers as unknown as {
    get?: (nama: string) => unknown;
    [nama: string]: unknown;
  };
  return headers?.get?.('X-Dari-Antrean') === '1' || headers?.['X-Dari-Antrean'] === '1';
};

/** Body axios kadang sudah diserialisasi menjadi string JSON. */
const dataUntukAntrean = (data: unknown): unknown => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

/**
 * Perubahan tulis yang gagal karena jaringan disimpan ke antrean offline dan
 * dianggap berhasil sementara (202). Pengguna melihat pesan bahwa perubahannya
 * akan dikirim otomatis; antrean diputar saat koneksi kembali.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as InternalAxiosRequestConfig | undefined;
    const tanpaRespons = !error?.response;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (config && !dariAntrean(config) && (tanpaRespons || offline)) {
      const { antrekanPermintaan, bolehDiantrekan } = await import('./offline');
      const data = dataUntukAntrean(config.data);

      if (
        bolehDiantrekan({
          method: config.method,
          url: config.url,
          data,
          responseType: config.responseType,
        })
      ) {
        try {
          await antrekanPermintaan({
            method: config.method,
            url: config.url || '',
            baseURL: config.baseURL,
            data,
          });

          return {
            data: {
              queued: true,
              message:
                'Perubahan disimpan di perangkat dan akan dikirim otomatis saat internet kembali.',
            },
            status: 202,
            statusText: 'Accepted',
            headers: {},
            config,
            request: null,
          };
        } catch (gagalAntre) {
          console.error('Gagal menyimpan perubahan ke antrean offline:', gagalAntre);
        }
      }
    }

    return Promise.reject(error);
  }
);

/** Akar server (tanpa /api), dipakai untuk membentuk URL berkas unggahan. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Mengubah path berkas dari backend (mis. /uploads/foto.jpg) menjadi URL lengkap.
 *
 * Foto profil dan galeri terbaru disimpan di Cloudinary sehingga kolomnya sudah
 * berisi URL absolut. URL seperti itu dikembalikan apa adanya — menambahkan
 * awalan origin akan merusaknya menjadi path yang tidak ada.
 */
export const assetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_ORIGIN}${path}`;
};
