/**
 * S2: jalur pembersihan luring saat sesi berakhir (AuthContext.tsx:48) dan saat
 * logout (AuthContext.tsx:77) sama-sama memanggil bersihkanCacheOffline().
 * Fungsi itu tidak bisa dites tanpa IndexedDB + Cache Storage, jadi kedua API
 * itu dipalsukan secukupnya: hanya metode yang benar-benar dipakai offline.ts
 * yang diimplementasi. Test ini membuktikan ISI fungsi, bukan bahwa AuthContext
 * memanggilnya (tidak ada harness React/DOM di repo ini; pemanggilannya
 * diverifikasi dengan membaca sumber).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

/**
 * offline.ts mengimpor './axios' tanpa ekstensi (Vite memaklumi), Node ESM
 * tidak. Hook ini hanya menutup celah resolusi itu; tidak mengubah apa pun.
 */
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

type Item = { id: string; ownerId?: string; [key: string]: unknown };

/** IndexedDB palsu: open/add/put/getAll/delete/clear, permintaan diselesaikan lewat microtask. */
const pasangIdbPalsu = (isi: Map<string, Item>) => {
  const permintaan = (hasilkan: () => unknown) => {
    const req = {} as { result?: unknown; onsuccess?: (() => void) | null; onerror?: (() => void) | null };
    queueMicrotask(() => {
      req.result = hasilkan();
      req.onsuccess?.();
    });
    return req;
  };

  const objectStore = {
    add: (item: Item) => {
      isi.set(item.id, item);
      return permintaan(() => item.id);
    },
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

/** Cache Storage palsu: hanya keys() dan delete() yang dipakai jalur ini. */
const pasangCachesPalsu = (namaAwal: string[]) => {
  const nama = new Set(namaAwal);
  (globalThis as Record<string, unknown>).caches = {
    keys: async () => [...nama],
    delete: async (k: string) => nama.delete(k),
    open: async () => ({}),
  };
  return nama;
};

const NAMA_CACHE = ['bem-ft-shell-v5', 'bem-ft-data-v5', 'bem-ft-gambar-v5'];

const siapkan = async (isiAntrean: Map<string, Item>) => {
  pasangIdbPalsu(isiAntrean);
  const cache = pasangCachesPalsu(NAMA_CACHE);
  // Entri bawaan-kredensial dibaca dari localStorage; tanpa stub, pemiliknya
  // 'tanpa-akun' dan tetap ikut terhitung.
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null,
    setItem: () => undefined,
  };
  const mod = await import(`../src/lib/offline.ts?t=${Math.random()}`);
  return { cache, ...mod };
};

test('a. logout mengosongkan antrean dan membuang cache data & gambar', async () => {
  const isi = new Map<string, Item>();
  const { tambahAntrean, daftarAntrean, bersihkanCacheOffline, cache } = await siapkan(isi);

  await tambahAntrean('POST', '/api/tickets', { judul: 'uji' });
  await tambahAntrean('PATCH', '/api/profile', { nama: 'uji' });
  assert.equal((await daftarAntrean()).length, 2, 'antrean terisi sebelum logout');

  await bersihkanCacheOffline();

  assert.equal((await daftarAntrean()).length, 0, 'antrean kosong sesudah logout');
  assert.equal(isi.size, 0, 'store IndexedDB benar-benar dibersihkan');
  assert.ok(!cache.has('bem-ft-data-v5'), 'cache JSON personal dibuang');
  assert.ok(!cache.has('bem-ft-gambar-v5'), 'cache gambar dibuang');
});

test('b. cache kerangka tetap disimpan agar aplikasi masih terbuka offline', async () => {
  const isi = new Map<string, Item>();
  const { bersihkanCacheOffline, cache } = await siapkan(isi);

  await bersihkanCacheOffline();

  assert.ok(cache.has('bem-ft-shell-v5'), 'shell tidak ikut terhapus');
});

test('c. pembersihan tetap aman bila Cache Storage dan service worker tidak ada', async () => {
  const isi = new Map<string, Item>();
  const { tambahAntrean, daftarAntrean, bersihkanCacheOffline } = await siapkan(isi);
  await tambahAntrean('POST', '/api/tickets', { judul: 'uji' });
  (globalThis as Record<string, unknown>).caches = undefined;

  await assert.doesNotReject(bersihkanCacheOffline());
  assert.equal((await daftarAntrean()).length, 0, 'antrean tetap kosong tanpa Cache Storage');
});
