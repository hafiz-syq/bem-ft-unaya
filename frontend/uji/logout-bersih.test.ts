/**
 * S2: jalur pembersihan luring saat sesi berakhir (AuthContext.tsx:48) dan saat
 * logout (AuthContext.tsx:77) sama-sama memanggil bersihkanCacheOffline().
 * Fungsi itu bekerja di atas IndexedDB + Cache Storage, yang dipalsukan lewat
 * alat bantu bersama (alat-bantu-luring.ts). Yang dibuktikan di sini adalah ISI
 * fungsi, bukan bahwa AuthContext memanggilnya: tidak ada harness React/DOM di
 * repo ini, jadi pemanggilannya diverifikasi dengan membaca sumber.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanLuring } from './alat-bantu-luring.ts';

test('a. logout mengosongkan antrean dan membuang cache data & gambar', async () => {
  const { isi, cache, offline } = await siapkanLuring();
  const { tambahAntrean, daftarAntrean, bersihkanCacheOffline } = offline;

  await tambahAntrean('POST', '/api/tickets', { judul: 'uji' });
  await tambahAntrean('PATCH', '/api/profile', { nama: 'uji' });
  assert.equal((await daftarAntrean()).length, 2, 'antrean terisi sebelum logout');

  await bersihkanCacheOffline();

  assert.equal((await daftarAntrean()).length, 0, 'antrean kosong sesudah logout');
  assert.equal(isi.size, 0, 'store IndexedDB benar-benar di-clear');
  assert.ok(!cache.has('bem-ft-data-v6'), 'cache JSON personal dibuang');
  assert.ok(!cache.has('bem-ft-gambar-v6'), 'cache gambar dibuang');
});

test('b. cache kerangka tetap disimpan agar aplikasi masih terbuka offline', async () => {
  const { cache, offline } = await siapkanLuring();

  await offline.bersihkanCacheOffline();

  assert.ok(cache.has('bem-ft-shell-v6'), 'shell tidak ikut terhapus');
});

test('c. pembersihan tetap selesai bila Cache Storage tidak tersedia', async () => {
  const { isi, offline } = await siapkanLuring();
  await offline.tambahAntrean('POST', '/api/tickets', { judul: 'uji' });
  assert.equal(isi.size, 1, 'antrean terisi sebelum pembersihan');
  (globalThis as Record<string, unknown>).caches = undefined;

  await assert.doesNotReject(offline.bersihkanCacheOffline());
  assert.equal(isi.size, 0, 'antrean tetap dikosongkan tanpa Cache Storage');
});
