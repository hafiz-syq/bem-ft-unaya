/**
 * Uji cerminan plafon percobaan antara public/sw.js dan src/lib/offline-keputusan.ts.
 * Service worker tidak bisa mengimpor modul dari src, jadi keputusannya ditulis
 * ulang di sw.js. Uji ini membandingkan keduanya supaya salinan tidak lari.
 * sw.js dijalankan di node:vm dengan `self` palsu; hanya deklarasi fungsi level
 * atas yang bisa diambil dari sana (keputusanTahanSw), dan BATAS_PERCOBAAN dibaca
 * lewat evaluasi ekspresi di konteks yang sama.
 * Loop sinkronkanAntrean() (IndexedDB + fetch) tidak dites di sini.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { keputusanKirim, BATAS_PERCOBAAN as BATAS_HALAMAN } from '../src/lib/offline-keputusan.ts';

const muatSw = () => {
  const sumber = fs.readFileSync(
    new URL('../public/sw.js', import.meta.url),
    'utf8'
  );
  const konteks = vm.createContext({
    self: { addEventListener: () => undefined },
  });
  vm.runInContext(sumber, konteks, { filename: 'sw.js' });
  return {
    keputusanTahanSw: konteks.keputusanTahanSw as (
      status: number | undefined,
      coba: number
    ) => string,
    batas: vm.runInContext('BATAS_PERCOBAAN', konteks) as number,
  };
};

const sw = muatSw();

/** Kosakata sw -> kosakata halaman: 'catat' = simpan & naikkan coba = 'pertahankan'. */
const keKosakataHalaman = (keputusan: string) =>
  keputusan === 'catat' ? 'pertahankan' : keputusan;

test('a. plafon sw sama dengan plafon halaman', () => {
  assert.equal(sw.batas, BATAS_HALAMAN);
});

test('b. 4xx sementara dicatat, bukan dibuang, selama belum mencapai plafon', () => {
  for (const status of [401, 403, 409, 429]) {
    assert.equal(sw.keputusanTahanSw(status, 0), 'catat', `status ${status}`);
  }
});

test('c. entri dibuang tepat pada kegagalan ke-BATAS_PERCOBAAN', () => {
  assert.equal(sw.keputusanTahanSw(401, sw.batas - 2), 'catat');
  assert.equal(sw.keputusanTahanSw(401, sw.batas - 1), 'buang');
});

test('d. 5xx dan tanpa respons tidak pernah menyalahkan entri', () => {
  assert.equal(sw.keputusanTahanSw(500, 0), 'hentikan');
  assert.equal(sw.keputusanTahanSw(503, sw.batas + 3), 'hentikan');
});

test('e. keputusan sw identik dengan keputusan halaman', () => {
  const daftarStatus = [401, 403, 408, 409, 429, 500, 502, 503, undefined];
  for (const status of daftarStatus) {
    for (let coba = 0; coba <= BATAS_HALAMAN + 1; coba += 1) {
      assert.equal(
        keKosakataHalaman(sw.keputusanTahanSw(status, coba)),
        keputusanKirim(false, status, coba),
        `status ${status} coba ${coba}`
      );
    }
  }
});
