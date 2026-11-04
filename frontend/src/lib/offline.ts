import { api } from './axios';
import { keputusanKirim, type KeputusanKirim } from './offline-keputusan';

/**
 * Mode offline & sinkronisasi otomatis.
 *
 * Perubahan tulis (POST/PUT/PATCH/DELETE) yang gagal karena jaringan disimpan
 * di IndexedDB, lalu dikirim ulang otomatis ketika koneksi kembali. Antrean
 * disimpan per akun dan dibersihkan saat logout / berganti akun agar tidak
 * pernah terkirim memakai sesi pengguna lain.
 *
 * Antrean juga dibaca oleh service worker (lewat Background Sync) ketika tab
 * sudah ditutup, sehingga data tetap tersinkronisasi tanpa membuka aplikasi.
 */

const NAMA_DB = 'bem-ft-offline';
const VERSI_DB = 1;
const NAMA_STORE = 'antrean';
const KUNCI_PEMILIK = 'bem-ft-pemilik-antrean';

export const EVENT_ANTREAN = 'bem-ft:antrean';
export const EVENT_TERSINKRON = 'bem-ft:tersinkron';

export interface ItemAntrean {
  id: string;
  ownerId: string;
  method: string;
  /** Jalur lengkap, mis. /api/tickets (sudah termasuk baseURL). */
  url: string;
  data?: unknown;
  createdAt: number;
  /** Jumlah percobaan kirim ulang yang gagal; entri lama belum memilikinya (0). */
  coba?: number;
}

export interface HasilAntrean {
  selesai: number;
  gagal: number;
  sisa: number;
}

export interface PermintaanUntukAntrean {
  method?: string;
  url?: string;
  data?: unknown;
  responseType?: string;
}

interface RegistrasiDenganSync extends ServiceWorkerRegistration {
  sync?: { register(tag: string): Promise<void> };
}

let janjiDb: Promise<IDBDatabase> | null = null;
let sedangMemproses = false;
let pemantauTerpasang = false;

const bukaDb = (): Promise<IDBDatabase> => {
  if (janjiDb) return janjiDb;

  janjiDb = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }

    const permintaan = indexedDB.open(NAMA_DB, VERSI_DB);
    permintaan.onupgradeneeded = () => {
      const db = permintaan.result;
      if (!db.objectStoreNames.contains(NAMA_STORE)) {
        db.createObjectStore(NAMA_STORE, { keyPath: 'id' });
      }
    };
    permintaan.onsuccess = () => resolve(permintaan.result);
    permintaan.onerror = () => reject(permintaan.error ?? new Error('Gagal membuka penyimpanan offline.'));
  });

  return janjiDb;
};

const selesaikan = <T,>(permintaan: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    permintaan.onsuccess = () => resolve(permintaan.result);
    permintaan.onerror = () => reject(permintaan.error ?? new Error('Operasi penyimpanan offline gagal.'));
  });

const buatId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // Lanjut ke ID berbasis waktu di bawah.
  }
  return `antrean-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/** ID pemilik antrean (akun yang sedang login), dibaca dari localStorage. */
export const pemilikAntrean = (): string => {
  try {
    return localStorage.getItem(KUNCI_PEMILIK) || '';
  } catch {
    return '';
  }
};

const jalurLengkap = (url: string, baseURL?: string): string => {
  if (/^https?:/i.test(url)) return url;
  if (!baseURL) return url;
  return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
};

/**
 * Jalur yang tidak boleh masuk antrean: autentikasi, push, status online,
 * obrolan langsung, endpoint internal, konversi gambar, dan pembuatan akun
 * admin (body-nya membawa password, dan antrean tersimpan di IndexedDB
 * perangkat — di laptop kampus itu berarti password orang lain tertinggal).
 */
const JALUR_DIABAIKAN = [
  /^\/auth(?:\/|$)/,
  /^\/push(?:\/|$)/,
  /^\/presence(?:\/|$)/,
  /^\/chat(?:\/|$)/,
  /^\/internal(?:\/|$)/,
  /^\/image-convert(?:\/|$)/,
  /^\/students\/admin(?:\/|$)/,
];

const METODE_TULIS = ['post', 'put', 'patch', 'delete'];

/** Apakah permintaan ini aman ditunda dan diulang saat online kembali? */
export const bolehDiantrekan = (permintaan: PermintaanUntukAntrean): boolean => {
  const metode = String(permintaan.method || 'get').toLowerCase();
  if (!METODE_TULIS.includes(metode)) return false;

  const url = String(permintaan.url || '');
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  if (permintaan.responseType && permintaan.responseType !== 'json') return false;
  if (JALUR_DIABAIKAN.some((pola) => pola.test(url))) return false;

  const data = permintaan.data;
  if (data !== undefined && data !== null) {
    if (typeof FormData !== 'undefined' && data instanceof FormData) return false;
    if (typeof Blob !== 'undefined' && data instanceof Blob) return false;
    if (data instanceof ArrayBuffer) return false;
    // Hanya body JSON terstruktur; string mentah/form-data tidak dapat diputar ulang.
    if (typeof data !== 'object') return false;
  }

  return true;
};

export async function tambahAntrean(
  method: string,
  url: string,
  data: unknown
): Promise<void> {
  const db = await bukaDb();
  const item: ItemAntrean = {
    id: buatId(),
    ownerId: pemilikAntrean() || 'tanpa-akun',
    method: method.toUpperCase(),
    url,
    data,
    createdAt: Date.now(),
  };

  await selesaikan(db.transaction(NAMA_STORE, 'readwrite').objectStore(NAMA_STORE).add(item));
}

export async function daftarAntrean(): Promise<ItemAntrean[]> {
  try {
    const db = await bukaDb();
    const semua = await selesaikan<ItemAntrean[]>(
      db.transaction(NAMA_STORE, 'readonly').objectStore(NAMA_STORE).getAll()
    );
    const pemilik = pemilikAntrean() || 'tanpa-akun';
    return semua
      .filter((item) => item.ownerId === pemilik)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function hitungAntrean(): Promise<number> {
  return (await daftarAntrean()).length;
}

export async function hapusAntrean(id: string): Promise<void> {
  try {
    const db = await bukaDb();
    await selesaikan(db.transaction(NAMA_STORE, 'readwrite').objectStore(NAMA_STORE).delete(id));
  } catch {
    // Entri yang tidak dapat dihapus akan dicoba lagi pada proses berikutnya.
  }
}

/** Naikkan penghitung percobaan gagal sebuah entri tanpa mengubah isinya. */
const catatPercobaan = async (item: ItemAntrean): Promise<void> => {
  try {
    const db = await bukaDb();
    await selesaikan(
      db
        .transaction(NAMA_STORE, 'readwrite')
        .objectStore(NAMA_STORE)
        .put({ ...item, coba: (item.coba ?? 0) + 1 })
    );
  } catch {
    // Gagal menulis hanya menunda plafon BATAS_PERCOBAAN; entri tetap utuh.
  }
};

export async function kosongkanAntrean(): Promise<void> {
  try {
    const db = await bukaDb();
    await selesaikan(db.transaction(NAMA_STORE, 'readwrite').objectStore(NAMA_STORE).clear());
  } catch {
    // Penyimpanan diblokir: tidak ada antrean yang bisa dibersihkan.
  }
}

/**
 * Antrean lama menyimpan url yang sudah digabung baseURL (mis.
 * `/api/students/admin`), jadi polanya tidak sama dengan JALUR_DIABAIKAN yang
 * menguji url relatif. Entri bawaan-kreditensial dibuang untuk SEMUA pemilik:
 * tanpa langkah ini, password admin yang terlanjur tersimpan di laptop kampus
 * tetap ikut diputar ulang begitu perangkat kembali online.
 */
const POLA_ANTREAN_KREDENSIAL = /\/students\/admin(\/|\?|#|$)/i;

export async function buangAntreanKredensial(): Promise<number> {
  try {
    const db = await bukaDb();
    const semua = await selesaikan<ItemAntrean[]>(
      db.transaction(NAMA_STORE, 'readonly').objectStore(NAMA_STORE).getAll()
    );
    const bahaya = semua.filter((item) => POLA_ANTREAN_KREDENSIAL.test(String(item.url)));
    for (const item of bahaya) await hapusAntrean(item.id);
    return bahaya.length;
  } catch {
    return 0;
  }
}

/**
 * Menetapkan pemilik antrean. Bila akun berganti, antrean lama dan data cache
 * dibersihkan supaya perubahan milik akun sebelumnya tidak terkirim dengan
 * sesi akun baru.
 */
export async function setelPemilikAntrean(userId: string | null): Promise<void> {
  // Jangan menghapus penanda saat pengguna belum termuat (user null di awal
  // aplikasi): penanda diperlukan untuk mengenali antrean milik sesi sebelumnya.
  if (!userId) return;

  try {
    const lama = localStorage.getItem(KUNCI_PEMILIK) || '';
    if (lama && lama !== userId) {
      await bersihkanCacheOffline();
    }
    localStorage.setItem(KUNCI_PEMILIK, userId);
  } catch {
    // localStorage diblokir; antrean memakai penanda 'tanpa-akun'.
  }
}

const kabarkanAntrean = (hasil: HasilAntrean): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<HasilAntrean>(EVENT_ANTREAN, { detail: hasil }));
};

/** Daftarkan Background Sync (bila didukung) agar antrean diputar juga saat tab ditutup. */
export async function mintaSinkronLatar(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const daftar = (await navigator.serviceWorker.ready) as RegistrasiDenganSync;
    if (daftar.sync) await daftar.sync.register('bem-ft-sinkron');
  } catch {
    // Browser tidak mendukung Background Sync; sinkronisasi tetap terjadi saat halaman terbuka.
  }
}

/** Simpan permintaan yang gagal karena jaringan ke antrean. */
export async function antrekanPermintaan(permintaan: {
  method?: string;
  url: string;
  baseURL?: string;
  data?: unknown;
}): Promise<void> {
  await tambahAntrean(
    permintaan.method || 'post',
    jalurLengkap(permintaan.url, permintaan.baseURL),
    permintaan.data
  );
  await mintaSinkronLatar();
  kabarkanAntrean({ selesai: 0, gagal: 0, sisa: await hitungAntrean() });
}

/**
 * Kirim ulang seluruh antrean secara berurutan.
 *
 * Hanya 400/422 (isi data benar-benar tidak valid) yang membuat entri dibuang.
 * 4xx lain dipertahankan dan henti sampai flush berikutnya — 401 berarti sesi
 * kedaluwarsa, 403 peran berubah, 429 limiter login — semuanya keadaan sementara
 * yang bisa pulih sendiri. Jaringan/5xx juga berhenti tanpa menyalahkan entri.
 * Entri yang dipertahankan dihitung percobaannya dan dibuang setelah
 * BATAS_PERCOBAAN (5) kali gagal agar antrean tidak macet selamanya.
 * Keputusan per percobaan ada di offline-keputusan.ts (murni, bisa dites).
 */
export async function prosesAntrean(): Promise<HasilAntrean> {
  if (sedangMemproses || typeof navigator === 'undefined' || !navigator.onLine) {
    return { selesai: 0, gagal: 0, sisa: await hitungAntrean() };
  }

  sedangMemproses = true;
  try {
    const daftar = await daftarAntrean();
    let selesai = 0;
    let gagal = 0;

    for (const item of daftar) {
      let keputusan: KeputusanKirim;
      try {
        await api.request({
          method: item.method,
          url: item.url,
          baseURL: '',
          data: item.data,
          headers: { 'X-Dari-Antrean': '1' },
        });
        keputusan = keputusanKirim(true, undefined, 0);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        keputusan = keputusanKirim(false, status, item.coba ?? 0);
      }

      if (keputusan === 'hapus') {
        await hapusAntrean(item.id);
        selesai += 1;
        continue;
      }
      if (keputusan === 'buang') {
        await hapusAntrean(item.id);
        gagal += 1;
        continue;
      }
      if (keputusan === 'pertahankan') await catatPercobaan(item);
      break;
    }

    const hasil: HasilAntrean = { selesai, gagal, sisa: await hitungAntrean() };
    kabarkanAntrean(hasil);
    if (selesai > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<HasilAntrean>(EVENT_TERSINKRON, { detail: hasil }));
    }
    return hasil;
  } finally {
    sedangMemproses = false;
  }
}

/**
 * Bersihkan antrean dan cache data milik akun (dipanggil saat logout atau
 * berganti akun). Cache gambar/galeri tidak perlu dihapus.
 */
export async function bersihkanCacheOffline(): Promise<void> {
  await kosongkanAntrean();

  try {
    if (typeof caches !== 'undefined') {
      const kunci = await caches.keys();
      await Promise.all(
        kunci
          .filter((nama) => nama.startsWith('bem-ft-data') || nama.startsWith('bem-ft-gambar'))
          .map((nama) => caches.delete(nama))
      );
    }
  } catch {
    // Cache Storage tidak tersedia.
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'BERSIHKAN_CACHE_DATA' });
  } catch {
    // Tidak ada service worker aktif.
  }

  kabarkanAntrean({ selesai: 0, gagal: 0, sisa: 0 });
}

/** Pasang pendengar koneksi & pesan service worker (sekali saja). */
export function pasangPemantauKoneksi(): void {
  if (pemantauTerpasang || typeof window === 'undefined') return;
  pemantauTerpasang = true;

  // Sekali di awal sesi: buang entri lama yang masih membawa kredensial.
  void buangAntreanKredensial();

  window.addEventListener('online', () => {
    void prosesAntrean();
  });

  window.addEventListener('offline', () => {
    void hitungAntrean().then((sisa) => kabarkanAntrean({ selesai: 0, gagal: 0, sisa }));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void prosesAntrean();
  });

  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'SINKRON_ANTREAN') void prosesAntrean();
  });

  // Jaring pengaman bila event 'online' tidak terpicu (mis. Wi-Fi tersambung
  // kembali tetapi perangkat tidak melaporkan perubahan status).
  window.setInterval(() => {
    if (!navigator.onLine) return;
    void hitungAntrean().then((sisa) => {
      if (sisa > 0) void prosesAntrean();
    });
  }, 45_000);
}
