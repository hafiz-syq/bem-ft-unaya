/**
 * IRISAN FEAT-3: mengklik menu samping tidak boleh lagi mencabut layout.
 *
 * Suite ini tidak punya jsdom, jadi yang dijaga adalah struktur sumbernya.
 * Batas Suspense untuk potongan halaman HARUS berada di dalam
 * <main id="konten-utama"> milik DashboardLayout. Kalau batas itu dipindah
 * kembali ke atas <Routes>, menu samping ikut tercabut setiap ganti halaman
 * dan posisi scroll pengguna hilang — bug yang dilaporkan pemilik.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baca = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const layout = baca('../src/layouts/DashboardLayout.tsx');
const app = baca('../src/App.tsx');

test('a. chunk halaman ditangani di dalam main, jadi sidebar tetap terpasang', () => {
  const main = layout.match(/<main id="konten-utama"[\s\S]*?<\/main>/);
  assert.ok(main, '<main id="konten-utama"> tidak ditemukan');
  assert.match(main[0], /<Suspense fallback=\{<MemuatHalaman \/>\}>\{children\}<\/Suspense>/);
});

test('b. App hanya membatasi rute terluar, satu batas saja', () => {
  assert.equal((app.match(/<Suspense/g) ?? []).length, 1, 'App seharusnya punya tepat satu batas Suspense');
  assert.match(app, /<Suspense fallback=\{<MemuatHalaman \/>\}>\s*<Routes>/);
});

test('c. ganti rute mulai dari atas halaman', () => {
  assert.match(layout, /useEffect\(\(\) => \{\s*window\.scrollTo\(0, 0\);\s*\}, \[location\.pathname\]\)/);
});

test('d. menu aktif dijaga tetap terlihat di scroller sidebar sendiri', () => {
  assert.match(layout, /<nav ref=\{navRef\}/);
  assert.match(
    layout,
    /navRef\.current\?\.querySelector\('\[aria-current="page"\]'\)\?\.scrollIntoView\(\{ block: 'nearest' \}\)/
  );
  assert.equal(
    (layout.match(/aria-current=\{isActive \? 'page' : undefined\}/g) ?? []).length,
    2,
    'penanda halaman aktif harus ada di sidebar desktop dan drawer mobile'
  );
});

test('e. fallback dimuat dari satu komponen, tidak disalin dua kali', () => {
  assert.match(layout, /from '\.\.\/components\/MemuatHalaman'/);
  assert.match(app, /from '\.\/components\/MemuatHalaman'/);
  assert.doesNotMatch(app, /function MemuatHalaman/);
});
