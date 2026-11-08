/**
 * ITERASI-AUDIT-18 F3: ruang forum prodi menjadi global tetapi perlu persetujuan.
 *
 * Suite ini tidak punya jsdom dan kolom `pendingApproval` belum boleh dibuat
 * (DDL ditahan pemilik), jadi yang dijaga adalah struktur sumbernya: penanda
 * tertunda harus sampai ke UI, ruang tertunda harus punya label yang bisa dibaca
 * pengguna, dan persetujuan harus lewat rute khusus -- bukan lewat tombol
 * Buka/Tutup yang sudah ada (assert K1 di backend menjaga gerbangnya terpisah).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const forum = baca('../src/pages/Forum.tsx');

test('a. ruang tertunda ikut dikirim ke UI dan ada labelnya', () => {
  assert.match(forum, /interface Ruang \{[\s\S]*?pendingApproval: boolean;/);
  assert.ok((forum.match(/Menunggu persetujuan/g) ?? []).length >= 1, 'ruang tertunda harus berlabel');
  assert.match(forum, /ruangAktif\.pendingApproval/);
});

test('b. penanda tampil di daftar ruang, bukan hanya di judul ruang aktif', () => {
  assert.match(forum, /\{r\.pendingApproval && \(/);
});

test('c. tombol Setujui memakai rute khusus approve, bukan PATCH isOpen', () => {
  assert.match(forum, /const setujuiRuang = async \(id: string\): Promise<void> => \{/);
  assert.match(forum, /api\.post\(`\/chat\/rooms\/\$\{id\}\/approve`\)/);
  assert.equal(/api\.patch\([^)]*\}\s*,\s*\{[^}]*pendingApproval/.test(forum), false, 'persetujuan tidak boleh menumpang PATCH status');
  assert.match(forum, /Setujui\s*<\/button>/);
});

test('d. persetujuan hanya muncul untuk pengelola forum', () => {
  const mulai = forum.indexOf('detail?.bolehKelola && (');
  assert.ok(mulai > 0, 'blok kontrol pengelola tidak ditemukan');
  const jendela = forum.slice(mulai, mulai + 1600);
  assert.match(jendela, /ruangAktif\.pendingApproval && \(/);
  assert.match(jendela, /setujuiRuang/);
});

test('e. pesan server saat membuat & menyetujui ruang ditampilkan, tidak dibuang', () => {
  assert.match(forum, /setNotice\(res\.data\?\.message \|\| 'Ruang berhasil dibuat\.'\)/);
  assert.match(forum, /setNotice\(res\.data\?\.message \|\| 'Ruang disetujui\.'\)/);
});
