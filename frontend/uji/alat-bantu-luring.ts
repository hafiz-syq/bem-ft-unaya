/**
 * Alat bantu uji untuk modul src/lib/offline.ts. Bukan file tes (tidak berakhiran
 * .test.ts, jadi tidak ikut dijalankan `node --test`), hanya tempat menaruh
 * palsuan API browser yang sama dipakai beberapa tes luring.
 *
 * offline.ts mengimpor './axios' tanpa ekstensi (Vite memaklumi, Node ESM tidak),
 * jadi hook resolusi dipasang di sini sebelum modul itu diimpor.
 */
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const dariSrcAplikasi =
      typeof context.parentURL === 'string' &&
      context.parentURL.includes('/src/lib/') &&
      !context.parentURL.includes('/node_modules/');
    if (dariSrcAplikasi && /^\.\.?\/[^.]+$/.test(specifier)) {
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

export type Item = { id: string; ownerId?: string; [key: string]: unknown };

export const NAMA_CACHE = ['bem-ft-shell-v6', 'bem-ft-data-v6', 'bem-ft-gambar-v6'];

/** IndexedDB palsu: hanya metode yang dipakai offline.ts, diselesaikan lewat microtask. */
export const pasangIdbPalsu = (isi: Map<string, Item>) => {
  const permintaan = (hasilkan: () => unknown) => {
    const req = {} as {
      result?: unknown;
      onsuccess?: (() => void) | null;
      onerror?: (() => void) | null;
    };
    queueMicrotask(() => {
      req.result = hasilkan();
      req.onsuccess?.();
    });
    return req;
  };

  const objectStore = {
    add: (item: Item) => permintaan(() => { isi.set(item.id, item); return item.id; }),
    put: (item: Item) => permintaan(() => { isi.set(item.id, item); return item.id; }),
    getAll: () => permintaan(() => [...isi.values()]),
    delete: (id: string) => permintaan(() => { isi.delete(id); return undefined; }),
    clear: () => permintaan(() => { isi.clear(); return undefined; }),
  };

  const db = {
    objectStoreNames: { contains: (nama: string) => nama === 'antrean' },
    createObjectStore: () => objectStore,
    transaction: () => ({ objectStore: () => objectStore }),
  };

  (globalThis as Record<string, unknown>).indexedDB = {
    open: () => {
      const req = {} as {
        result?: unknown;
        error?: unknown;
        onupgradeneeded?: (() => void) | null;
        onsuccess?: (() => void) | null;
        onerror?: (() => void) | null;
      };
      req.result = db;
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
};

/** Cache Storage palsu: hanya keys()/delete() yang dipakai jalur pembersihan. */
export const pasangCachesPalsu = (namaAwal: string[] = NAMA_CACHE) => {
  const nama = new Set(namaAwal);
  (globalThis as Record<string, unknown>).caches = {
    keys: async () => [...nama],
    delete: async (k: string) => nama.delete(k),
    open: async () => ({}),
  };
  return nama;
};

/**
 * navigator.serviceWorker palsu. `ready` dibuat TIDAK pernah resolve — persis
 * kondisi browser tanpa service worker aktif (mode privat iOS, registrasi gagal,
 * dev tanpa SW) yang dulu membuat antrekanPermintaan menggantung selamanya.
 * getRegistration() selalu selesai; dengan dukungSync=true ia mengembalikan
 * registrasi yang punya SyncManager, seperti Chromium.
 */
export const pasangNavigatorSw = (dukungSync = false) => {
  const terlihat = {
    readyDisentuh: false,
    registrasiDisentuh: false,
    tagSync: [] as string[],
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      onLine: false,
      serviceWorker: {
        get ready() {
          terlihat.readyDisentuh = true;
          return new Promise(() => undefined);
        },
        getRegistration: async () => {
          terlihat.registrasiDisentuh = true;
          return dukungSync
            ? { sync: { register: async (tag: string) => { terlihat.tagSync.push(tag); } } }
            : undefined;
        },
      },
    },
  });
  return terlihat;
};

/** Modul offline.ts versi baru (instansai terpisah per tes: janjiDb ikut segar). */
export const imporOffline = async () =>
  await import(`../src/lib/offline.ts?t=${Math.random()}`);

/** Setel pemalsuan yang selalu dibutuhkan offline.ts: IndexedDB, cache, localStorage. */
export const siapkanLuring = async (isiAntrean: Map<string, Item> = new Map()) => {
  pasangIdbPalsu(isiAntrean);
  const cache = pasangCachesPalsu();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null,
    setItem: () => undefined,
  };
  return { isi: isiAntrean, cache, offline: await imporOffline() };
};

/** Janji yang ditolak bila `janji` belum selesai dalam `ms` — dipakai untuk uji "selalu resolve". */
export function denganBatasWaktu<T>(janji: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    janji,
    new Promise<never>((_, tolak) =>
      setTimeout(() => tolak(new Error(`${label} tidak selesai dalam ${ms}ms`)), ms)
    ),
  ]);
}

// --- Sandbox public/sw.js --------------------------------------------------
//
// Service worker tidak bisa diimpor sebagai modul (ia langsung memanggil
// self.addEventListener saat dimuat), jadi sumbernya dievaluasi di node:vm
// dengan `self` dan Cache Storage palsu. Response/Headers/URL adalah kelas Node
// yang kompatibel Fetch dan dipakai apa adanya. Request Node TIDAK menampilkan
// `destination`, jadi permintaan dibuat sebagai objek polos — sw.js hanya
// membaca url/method/destination/mode.

export const ASAL_APLIKASI = 'https://app.test';

export type PermintaanPalsu = {
  url: string;
  method: string;
  destination: string;
  mode: string;
};

export const buatPermintaanPalsu = (
  url: string,
  opsi: { destination?: string; mode?: string; method?: string } = {}
): PermintaanPalsu => ({
  url,
  method: opsi.method ?? 'GET',
  destination: opsi.destination ?? '',
  mode: opsi.mode ?? 'cors',
});

/** Respons asli dengan header/isi/status yang ditentukan tes; status 0 = opaque. */
export const buatResponsPalsu = (
  opsi: { status?: number; headers?: Record<string, string>; body?: string; type?: string } = {}
): Response => {
  const status = opsi.status ?? 200;
  const tersusun = new Response(status === 0 ? null : (opsi.body ?? ''), {
    status: status === 0 ? 200 : status,
    headers: opsi.headers,
  });
  const respons = Object.defineProperty(tersusun, 'status', { value: status });
  if (opsi.type) Object.defineProperty(respons, 'type', { value: opsi.type });
  if (status === 0) Object.defineProperty(respons, 'ok', { value: false });
  return respons;
};

const alamat = (input: unknown) =>
  typeof input === 'string' ? input : ((input as { url: string }).url ?? String(input));

/** Satu cache palsu; penghitung dipakai tes untuk membuktikan berapa kali dipindai. */
export class CachePalsu {
  readonly nama: string;
  jumlahMatch = 0;
  jumlahKeys = 0;
  #isi = new Map<string, Response>();

  constructor(nama: string) {
    this.nama = nama;
  }

  urls = (): string[] => [...this.#isi.keys()];

  async keys() {
    this.jumlahKeys += 1;
    return this.urls().map((url) => buatPermintaanPalsu(url));
  }

  async match(permintaan: unknown) {
    this.jumlahMatch += 1;
    const tersimpan = this.#isi.get(alamat(permintaan));
    return tersimpan ? tersimpan.clone() : undefined;
  }

  async put(permintaan: unknown, respons: Response) {
    this.#isi.set(alamat(permintaan), respons);
  }

  async delete(permintaan: unknown) {
    return this.#isi.delete(alamat(permintaan));
  }
}

/** Cache Storage palsu dengan isi yang bisa diperiksa, dipakai bersama SW dan halaman. */
export class CacheStoragePalsu {
  #cache = new Map<string, CachePalsu>();

  constructor(namaAwal: string[] = NAMA_CACHE) {
    for (const nama of namaAwal) this.#cache.set(nama, new CachePalsu(nama));
  }

  async keys() {
    return [...this.#cache.keys()];
  }

  async open(nama: string) {
    let cache = this.#cache.get(nama);
    if (!cache) {
      cache = new CachePalsu(nama);
      this.#cache.set(nama, cache);
    }
    return cache;
  }

  async delete(nama: string) {
    return this.#cache.delete(nama);
  }

  has = (nama: string) => this.#cache.has(nama);

  /** URL yang tersimpan di satu cache (kosong bila cache-nya sudah dibuang). */
  urls = (nama: string) => this.#cache.get(nama)?.urls() ?? [];

  /** URL di semua cache yang masih ada — dipakai untuk membuktikan tidak ada sisa. */
  urlsSemua = () => [...this.#cache.values()].flatMap((cache) => cache.urls());

  async match(permintaan: unknown, opsi?: { cacheName?: string }) {
    const candidates = opsi?.cacheName
      ? [this.#cache.get(opsi.cacheName)]
      : [...this.#cache.values()];
    for (const cache of candidates) {
      const hasil = cache && (await cache.match(permintaan));
      if (hasil) return hasil;
    }
    return undefined;
  }
}

const sumberSw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((selesai) => setTimeout(selesai, 0));
};

/**
 * Muat public/sw.js di konteks terisolasi dengan fetch terkendali dan pasang
 * cache palsunya sebagai globalThis.caches, sehingga modul halaman (offline.ts)
 * dan service worker melihat Cache Storage yang sama.
 */
export const siapkanSwLuring = async (
  opsi: { respons?: (permintaan: PermintaanPalsu) => Response } = {}
) => {
  const store = new CacheStoragePalsu();
  const pendengar: Record<string, ((event: unknown) => void)[]> = {};
  const terambil: string[] = [];

  const self = {
    location: { origin: ASAL_APLIKASI, href: `${ASAL_APLIKASI}/` },
    addEventListener: (tipe: string, fn: (event: unknown) => void) => {
      (pendengar[tipe] ??= []).push(fn);
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    skipWaiting: async () => undefined,
    registration: { showNotification: () => undefined },
  };

  const fetchPalsu = async (input: unknown) => {
    const permintaan =
      typeof input === 'string' ? buatPermintaanPalsu(input) : (input as PermintaanPalsu);
    terambil.push(permintaan.url);
    return opsi.respons
      ? opsi.respons(permintaan)
      : buatResponsPalsu({ headers: { date: new Date().toUTCString() } });
  };

  const konteks = vm.createContext({
    self,
    caches: store,
    console,
    URL,
    Headers,
    Response,
    Request,
    Blob,
    TextDecoder,
    fetch: fetchPalsu,
  });
  vm.runInContext(sumberSw, konteks, { filename: 'sw.js' });
  (globalThis as Record<string, unknown>).caches = store;

  /** Jalankan satu peristiwa SW dan kembalikan respons respondWith + janji waitUntil. */
  const kirim = async (tipe: string, properti: Record<string, unknown> = {}) => {
    const ditahan: Promise<unknown>[] = [];
    let dijawab: Promise<unknown> | undefined;
    const event = {
      ...properti,
      respondWith: (janji: Promise<unknown>) => {
        dijawab = Promise.resolve(janji);
      },
      waitUntil: (janji: Promise<unknown>) => {
        ditahan.push(Promise.resolve(janji));
      },
    };
    for (const fn of pendengar[tipe] ?? []) fn(event);
    await flush();
    const respons = (dijawab ? await dijawab : undefined) as Response | undefined;
    await Promise.all(ditahan);
    await flush();
    return { respons, jumlahWaitUntil: ditahan.length };
  };

  /** Baca deklarasi level atas sw.js (const top-level tidak menempel di globalThis). */
  const baca = (ekspresi: string) => vm.runInContext(ekspresi, konteks) as unknown;

  return { store, konteks, baca, kirim, terambil, flush };
};

