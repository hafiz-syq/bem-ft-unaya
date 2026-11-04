/**
 * Uji tabel keputusan tombol pasang aplikasi. Tidak menyentuh DOM: yang diuji
 * hanya tentukanMode() di src/lib/pasang-aplikasi.ts.
 * Jalankan: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tentukanMode } from '../src/lib/pasang-aplikasi.ts';

test('a. sudah terpasang -> disembunyikan di semua platform', () => {
  assert.equal(tentukanMode({ terpasang: true, ios: false, punyaPrompt: true }), 'sembunyi');
  assert.equal(tentukanMode({ terpasang: true, ios: true, punyaPrompt: false }), 'sembunyi');
});

test('b. iOS -> panduan manual, meski prompt tidak pernah datang', () => {
  assert.equal(tentukanMode({ terpasang: false, ios: true, punyaPrompt: false }), 'manual');
  assert.equal(tentukanMode({ terpasang: false, ios: true, punyaPrompt: true }), 'manual');
});

test('c. Chromium dengan prompt -> tombol otomatis', () => {
  assert.equal(tentukanMode({ terpasang: false, ios: false, punyaPrompt: true }), 'otomatis');
});

test('d. tanpa prompt dan bukan iOS -> disembunyikan (dev, Firefox, browser lama)', () => {
  assert.equal(tentukanMode({ terpasang: false, ios: false, punyaPrompt: false }), 'sembunyi');
});
