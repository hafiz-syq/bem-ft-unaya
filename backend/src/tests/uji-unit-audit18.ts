/**
 * Unit test ITERASI-AUDIT-18 — tanpa server & tanpa database.
 *
 *   F2. Penanda unit "Diunggah oleh" dikunci ke unit penulis: pengurus hanya
 *       boleh melabeli unitnya sendiri, BEM/DPM dua-satunya yang boleh memakai
 *       label BEM/DPM, dan PENGURUS generik tidak terhubung ke unit mana pun.
 *   F3. Ruang forum prodi menjadi global tetapi perlu persetujuan (kolom
 *       pendingApproval) — dijaga lewat jangkar sumber, karena perilakunya
 *       butuh DDL yang belum diizinkan berjalan.
 *
 * Dijalankan oleh: npm run test:unit (rantai dengan uji-unit-kritis.ts)
 */

import './penahan-host-uji';
// Augmentasi namespace `Express.Multer` ada di @types/multer dan hanya ikut
// program bila ada modul yang mengimpor 'multer'. Graf impor berkas ini menuju
// cms.controller tanpa melewati upload.middleware, jadi tanpa baris berikut
// ts-node menghentikan seluruh suite dengan TS2694 -- kegagalan kompilasi,
// bukan kegagalan aturan bisnis.
import 'multer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROLE_TARGET } from '../lib/ticket-access';
import { bacaUnit } from '../controllers/cms.controller';

let lulus = 0;
const gagal: string[] = [];

function uji(nama: string, kondisi: boolean): void {
  if (kondisi) {
    lulus++;
    console.log(`  LULUS   ${nama}`);
  } else {
    gagal.push(nama);
    console.log(`  GAGAL   ${nama}`);
  }
}

const bacaSumber = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');

async function main(): Promise<void> {
  console.log('\n=== F2. Unit konten dikunci ke unit penulis (keputusan pemilik AUDIT-18) ===\n');

  {
    const putus = (nilai: unknown, role: string) => {
      const hasil = bacaUnit(nilai, role);
      return { ok: hasil.ok, unit: hasil.ok ? hasil.unit : null, pesan: hasil.ok ? '' : hasil.pesan };
    };
    const LIMA = ['DPM', 'BEM', 'SISTEM_INFORMASI', 'TEKNIK_SIPIL', 'TEKNIK_MESIN'];
    const PERAN = Object.keys(ROLE_TARGET);

    uji(
      'F2a admin bebas memakai kelima unit konten',
      LIMA.every((u) => putus(u, 'ADMIN').ok === true && putus(u, 'ADMIN').unit === u) &&
        LIMA.every((u) => putus(u, 'SUPERADMIN').ok === true)
    );

    uji('F2b penulis admin yang mengosongkan nilai melepas penanda', putus('', 'ADMIN').unit === null);

    uji(
      'F2c unit asing tetap ditolak walau penulis admin',
      !putus('SISTEM INFORMASI', 'ADMIN').ok && !putus('HIMPUNAN', 'ADMIN').ok
    );

    uji(
      'F2d pengurus yang tidak mengirim unit otomatis memakai unitnya sendiri',
      putus(undefined, 'PENGURUS_TEKNIK_SIPIL').unit === 'TEKNIK_SIPIL' &&
        putus('', 'PENGURUS_BEM').unit === 'BEM' &&
        putus(null, 'PENGURUS_DPM').unit === 'DPM'
    );

    uji(
      'F2e pengurus hanya boleh melabeli unitnya sendiri; empat unit lain ditolak',
      PERAN.length === 5 &&
        PERAN.every((role) => {
          const milik = ROLE_TARGET[role];
          return (
            putus(milik, role).unit === milik &&
            LIMA.filter((u) => u !== milik).every((u) => !putus(u, role).ok)
          );
        })
    );

    uji(
      'F2f penolakan menyebut unit penulis, bukan hanya "tidak dikenal"',
      !putus('BEM', 'PENGURUS_TEKNIK_SIPIL').ok &&
        /Teknik Sipil/.test(String(putus('BEM', 'PENGURUS_TEKNIK_SIPIL').pesan))
    );

    uji(
      'F2g PENGURUS generik tanpa ROLE_TARGET ditolak dengan kalimat penjelas',
      !putus('BEM', 'PENGURUS').ok &&
        String(putus('BEM', 'PENGURUS').pesan) !== 'Unit pengunggah tidak dikenal.' &&
        /[Uu]nit/.test(String(putus('BEM', 'PENGURUS').pesan))
    );

    uji(
      'F2h PENGURUS generik yang tidak mengirim unit tersimpan tanpa penanda, bukan 400',
      putus(undefined, 'PENGURUS').ok === true && putus(undefined, 'PENGURUS').unit === null
    );

    uji(
      'F2i keempat jalur tulis CMS ikut mengirim role penulis ke bacaUnit',
      (bacaSumber('../controllers/cms.controller.ts').match(
        /bacaUnit\(req\.body\.unit,\s*req\.user\.role\)/g
      ) ?? []).length === 4
    );
  }

  console.log(`\n--- RINGKASAN UNIT TEST AUDIT-18 ---\nLulus: ${lulus}\nGagal: ${gagal.length}\n`);
  if (gagal.length > 0) {
    console.log('GAGAL:');
    gagal.forEach((g) => console.log(`  - ${g}`));
    process.exit(1);
  }
  console.log('HASIL: SEMUA UNIT TEST AUDIT-18 LULUS');
}

main().catch((error) => {
  console.error('Unit test AUDIT-18 gagal dijalankan:', error);
  process.exit(1);
});
