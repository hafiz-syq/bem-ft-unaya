/**
 * ITERASI-AUDIT-18 F2: penanda unit "Diunggah oleh" dikunci ke unit penulis.
 *
 * Yang memutuskan tetap server (`bacaUnit` di cms.controller, diuji di
 * backend/src/tests/uji-unit-kritis.ts J2a-J2i). Suite ini menjaga sisi UI:
 * memilihkan opsi yang pasti ditolak 400 sama dengan kegagalan simpan tanpa
 * alasan, dan mengirim ulang label unit lain yang tertinggal dari item suntingan
 * admin juga ditolak server setelah F2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROLE_UNIT_KONTEN, unitKontenPenulis } from '../src/lib/roles.ts';

const baca = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const cms = baca('../src/pages/CMSManager.tsx');
const rolesBe = baca('../../backend/src/lib/ticket-access.ts');

/** Pasangan `ROLE: 'UNIT'` dari sebuah literal objek di sumber. */
const pasangan = (sumber: string, nama: string): string[] => {
  const blok = sumber.match(new RegExp(`(?:export )?const ${nama}[^=]*=[\\s\\S]*?\\};`));
  return blok ? (blok[0].match(/(\w+):\s*'([A-Z_]+)'/g) ?? []).map((s) => s.replace(/\s+/g, ' ')) : [];
};

test('a. peta unit penulis FE = cermin ROLE_TARGET backend, pasangan persis sama', () => {
  const be = pasangan(rolesBe, 'ROLE_TARGET').sort();
  const fe = pasangan(baca('../src/lib/roles.ts'), 'ROLE_UNIT_KONTEN').sort();
  assert.ok(be.length === 5, `ROLE_TARGET backend harus 5 pasangan, terbaca ${be.length}`);
  assert.deepEqual(fe, be);
});

test('b. lima pengurus punya unit penulis; PENGURUS generik, mahasiswa, admin tidak', () => {
  assert.equal(unitKontenPenulis('PENGURUS_SISTEM_INFORMASI'), 'SISTEM_INFORMASI');
  assert.equal(unitKontenPenulis('PENGURUS_TEKNIK_MESIN'), 'TEKNIK_MESIN');
  assert.equal(unitKontenPenulis('PENGURUS_TEKNIK_SIPIL'), 'TEKNIK_SIPIL');
  assert.equal(unitKontenPenulis('PENGURUS_BEM'), 'BEM');
  assert.equal(unitKontenPenulis('PENGURUS_DPM'), 'DPM');
  assert.equal(unitKontenPenulis('PENGURUS'), null);
  assert.equal(unitKontenPenulis('MAHASISWA'), null);
  assert.equal(unitKontenPenulis('ADMIN'), null);
  assert.equal(unitKontenPenulis(undefined), null);
  assert.equal(Object.keys(ROLE_UNIT_KONTEN).length, 5);
});

test('c. kedua select unit dinonaktifkan untuk penulis non-admin', () => {
  assert.equal((cms.match(/disabled=\{!bolehPilihUnit\}/g) ?? []).length, 2, 'unit-konten & unit-agenda');
  assert.match(cms, /<select id="unit-konten"[\s\S]{0,500}?disabled=\{!bolehPilihUnit\}/);
  assert.match(cms, /<select id="unit-agenda"[\s\S]{0,500}?disabled=\{!bolehPilihUnit\}/);
});

test('d. opsi yang ditawarkan mengikuti penulis, bukan daftar lima lengkap', () => {
  assert.match(cms, /const opsiUnit: string\[\] = bolehPilihUnit \? \[\.\.\.KONTEN_UNITS\] : unitSaya \? \[unitSaya\] : \[\];/);
  assert.equal((cms.match(/opsiUnit\.map/g) ?? []).length, 2);
  assert.equal((cms.match(/KONTEN_UNITS\.map/g) ?? []).length, 0, 'UI tidak boleh lagi memetakan lima unit untuk semua orang');
});

test('e. nilai terkirim ikut terkunci, tidak mengulang label unit asing', () => {
  assert.match(cms, /const unitTerkirim = \(nilai: string\) => \(bolehPilihUnit \? nilai : unitSaya \?\? ''\);/);
  assert.equal((cms.match(/unitTerkirim\(/g) ?? []).length, 2, 'jalur kirim konten & agenda');
  assert.match(cms, /data\.append\('unit', unitTerkirim\(formData\.unit\)\)/);
  assert.match(cms, /unit: unitTerkirim\(agendaData\.unit\)/);
});

test('f. alasan penonaktifan ditulis, bukan hanya select yang abu-abu', () => {
  assert.equal((cms.match(/Penanda unit terkunci pada unit Anda/g) ?? []).length, 2);
  assert.equal((cms.match(/Role Anda belum terhubung ke satu unit/g) ?? []).length, 2);
});
