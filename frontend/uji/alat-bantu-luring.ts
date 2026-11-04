/**
 * Alat bantu uji untuk modul src/lib/offline.ts. Bukan file tes (tidak berakhiran
 * .test.ts, jadi tidak ikut dijalankan `node --test`), hanya tempat menaruh
 * palsuan API browser yang sama dipakai beberapa tes luring.
 *
 * offline.ts mengimpor './axios' tanpa ekstensi (Vite memaklumi, Node ESM tidak),
 * jadi hook resolusi dipasang di sini sebelum modul itu diimpor.
 */
import { registerHooks } from 'node:module';

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

export const NAMA_CACHE = ['bem-ft-shell-v5', 'bem-ft-data-v5', 'bem-ft-gambar-v5'];

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
