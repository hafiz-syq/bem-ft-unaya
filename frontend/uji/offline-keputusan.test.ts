/**
 * Uji keputusan antrean luring (P6) TANPA browser/IndexedDB: yang diuji adalah
 * fungsi keputusan murni hasil ekstrak di src/lib/offline-keputusan.ts.
 * Jalankan: npm run test:unit (node --test dengan penyisihan tipe bawaan Node 24).
 * Loop prosesAntrean() sendiri (IndexedDB + axios) tidak dites di sini.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keputusanKirim, BATAS_PERCOBAAN } from '../src/lib/offline-keputusan.ts';

test('a. 401 sesi kedaluwarsa tidak membuang entri', () => {
  assert.equal(keputusanKirim(false, 401, 0), 'pertahankan');
});

test('b. 400 dan 422 (isi data tidak valid) membuang entri', () => {
  assert.equal(keputusanKirim(false, 400, 0), 'buang');
  assert.equal(keputusanKirim(false, 422, 0), 'buang');
});

test('c. 429 limiter — dan 403/409 — tidak membuang entri', () => {
  assert.equal(keputusanKirim(false, 429, 0), 'pertahankan');
  assert.equal(keputusanKirim(false, 403, 0), 'pertahankan');
  assert.equal(keputusanKirim(false, 409, 0), 'pertahankan');
});

test('d. entri dibuang tepat pada kegagalan ke-BATAS_PERCOBAAN', () => {
  assert.equal(keputusanKirim(false, 401, BATAS_PERCOBAAN - 2), 'pertahankan');
  assert.equal(keputusanKirim(false, 401, BATAS_PERCOBAAN - 1), 'buang');
  assert.equal(keputusanKirim(false, 429, BATAS_PERCOBAAN - 1), 'buang');
});

test('e. sukses menghapus entri dan lanjut; jaringan/5xx berhenti tanpa menyalahkan entri', () => {
  // 'hapus' = entri dihapus lalu loop MELANJUT ke entri berikutnya
  // (bukan 'hentikan'); 'buang' juga lanjut, 'pertahankan'/'hentikan' berhenti.
  assert.equal(keputusanKirim(true, 200, 0), 'hapus');
  assert.notEqual(keputusanKirim(true, 200, 0), 'hentikan');
  assert.equal(keputusanKirim(false, 500, BATAS_PERCOBAAN - 1), 'hentikan');
  assert.equal(keputusanKirim(false, undefined, 0), 'hentikan');
});
