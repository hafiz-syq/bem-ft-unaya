/**
 * S5: antrekanPermintaan() harus SELALU selesai. Ia await mintaSinkronLatar(),
 * yang dulu menunggu navigator.serviceWorker.ready — janji yang tidak pernah
 * resolve selama tidak ada service worker aktif (mode privat iOS, registrasi
 * gagal, dev tanpa SW; iOS juga tidak punya Background Sync sama sekali).
 * Akibatnya: baris antrean sudah tersimpan di IndexedDB, tapi panggilan axios
 * yang menangkap kesalahan jaringan ikut menggantung dan spinner tidak mati.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanLuring, pasangNavigatorSw, denganBatasWaktu } from './alat-bantu-luring.ts';

const BATAS_UJI_MS = 1000;

test('a. tanpa service worker aktif: antrekanPermintaan tetap resolve dan entri tersimpan', async () => {
  const { isi, offline } = await siapkanLuring();
  const terlihat = pasangNavigatorSw(false);

  await denganBatasWaktu(
    offline.antrekanPermintaan({ method: 'post', url: '/api/tickets', data: { judul: 'uji' } }),
    BATAS_UJI_MS,
    'antrekanPermintaan'
  );

  assert.equal(isi.size, 1, 'entri antrean tetap tersimpan');
  assert.equal(terlihat.registrasiDisentuh, true, 'jalur sinkron memakai getRegistration()');
});

test('b. siapSinkronLatar tidak pernah menyentuh .ready', async () => {
  const { offline } = await siapkanLuring();
  const terlihat = pasangNavigatorSw(false);

  await denganBatasWaktu(offline.mintaSinkronLatar(), BATAS_UJI_MS, 'mintaSinkronLatar');

  assert.equal(terlihat.readyDisentuh, false, '.ready tidak boleh ditunggu lagi');
});

test('c. Chromium dengan Background Sync tetap mendaftarkan tag sinkron', async () => {
  const { offline } = await siapkanLuring();
  const terlihat = pasangNavigatorSw(true);

  await denganBatasWaktu(
    offline.antrekanPermintaan({ method: 'put', url: '/api/profile', data: { nama: 'uji' } }),
    BATAS_UJI_MS,
    'antrekanPermintaan'
  );

  assert.deepEqual(terlihat.tagSync, ['bem-ft-sinkron'], 'tag sync lama tetap dipakai');
});
