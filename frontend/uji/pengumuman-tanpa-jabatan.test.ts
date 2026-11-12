/**
 * ITERASI-AUDIT-20 N-A: penulis tanpa jabatan aktif tidak boleh berakhir buntu
 * tanpa penjelasan.
 *
 * Setelah F1, pengumuman non-admin wajib menyebut organisasi dari jabatan
 * aktifnya sendiri. Akun PENGURUS_* yang belum pernah diberi slot sekarang kena
 * 403 'Akun Anda tidak punya jabatan aktif...' — dan itu baru muncul SETELAH ia
 * selesai menulis judul + isi. Suite ini menjaga sisi klien: Kirim dikunci
 * sebelum permintaan berangkat, dan alasannya menyebut jalan keluar.
 *
 * Yang TIDAK diubah: 403 server tetap sumber kebenaran (tidak dilonggarkan,
 * tidak ada khalayak baru). Assert di sini struktural, tanpa render.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const halaman = baca('../src/pages/Announcements.tsx');

test('a. Kirim diblokir di klien sebelum permintaan berangkat, hanya di jalur buat', () => {
  assert.match(
    halaman,
    /const kunciKirim = !editingId && !admin[\s\S]{0,120}organisasi\.length === 0/,
    'penanda jalan buntu harus menggabungkan: bukan suntingan, non-admin, daftar organisasi penulis kosong'
  );
  assert.match(halaman, /if \(kunciKirim\) \{\s*setError\(TANPA_JABATAN\);\s*return;/);
  const guard = halaman.indexOf('if (kunciKirim)');
  const kirim = halaman.indexOf("api.post('/announcements'");
  assert.ok(guard >= 0 && kirim >= 0 && guard < kirim, 'guard harus mendahului api.post');
  assert.equal(halaman.match(/setMenyimpan\(true\)/g)?.length, 1, 'satu-satunya jalur submit');
  assert.ok(halaman.indexOf('if (kunciKirim)') < halaman.indexOf('setMenyimpan(true)'), 'guard di depan setMenyimpan');
});

test('b. tombol submit ikut dikunci, bukan hanya mengandalkan validasi bawaan', () => {
  assert.match(halaman, /disabled=\{menyimpan \|\| kunciKirim\}/);
  assert.equal((halaman.match(/disabled=\{menyimpan\}/g) ?? []).length, 0, 'tombol tidak boleh lagi hanya melihat menyimpan');
});

test('c. kalimat alasan menyebut jalan keluar dan tampil dua kali', () => {
  const definisi = halaman.match(/const TANPA_JABATAN =\s*(['`])([\s\S]*?)\1;/);
  assert.ok(definisi, 'alasan harus satu konstanta, tidak ditulis ulang di dua tempat');
  const teks = definisi[2];
  assert.match(teks, /belum punya jabatan aktif/i);
  assert.match(teks, /admin/i, 'harus menyebut siapa yang menetapkan jabatan');
  assert.match(teks, /organisator/i);
  assert.equal(
    (halaman.match(/TANPA_JABATAN/g) ?? []).length,
    3,
    'definisi + setError guard + teks di bawah dropdown'
  );
});

test('d. kontrol: 403 server tidak dilonggarkan dan tidak ada khalayak baru', () => {
  const BE = baca('../../backend/src/controllers/announcement.controller.ts');
  assert.match(BE, /Akun Anda tidak punya jabatan aktif, jadi tidak ada organisasi yang bisa disiari\./);
  assert.match(BE, /export const cakupanButuhAdmin = \(audience: string\): boolean => audience !== 'ORGANISASI'/);
  assert.equal((halaman.match(/<option value="UNIT"/g) ?? []).length, 0, 'N-A diselesaikan di UI, bukan dengan audience baru');
});
