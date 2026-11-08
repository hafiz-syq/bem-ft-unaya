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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

  console.log('\n=== F3. Ruang forum prodi: global tetapi perlu persetujuan (DDL lokal saja) ===\n');

  {
    const sumberChat = bacaSumber('../controllers/chat.controller.ts');
    const sumberRute = bacaSumber('../routes/chat.routes.ts');
    const skema = bacaSumber('../../prisma/schema.prisma');

    // Sengaja lewat require, bukan import: selama langkah RED simbolnya belum
    // ada, dan impor langsung membuat ts-node menghentikan seluruh berkas
    // (TS2305) alih-alih menunjukkan kegagalan aturan bisnis.
    const chat = require('../controllers/chat.controller') as {
      ruangPerluPersetujuan?: (role: string | undefined) => boolean;
    };
    const perlu = chat.ruangPerluPersetujuan;

    uji(
      'F3a hanya pembuat ruang non-pengelola yang tertunda; BEM/DPM/admin langsung tayang',
      typeof perlu === 'function' &&
        ['PENGURUS_SISTEM_INFORMASI', 'PENGURUS_TEKNIK_SIPIL', 'PENGURUS_TEKNIK_MESIN'].every(
          (role) => perlu(role) === true
        ) &&
        ['PENGURUS_BEM', 'PENGURUS_DPM', 'ADMIN', 'SUPERADMIN', 'MAHASISWA', 'PENGURUS', undefined].every(
          (role) => perlu(role) === false
        )
    );

    uji(
      'F3b kolom pendingApproval ada di model ChatRoom dengan default false',
      /model ChatRoom \{[\s\S]*?pendingApproval Boolean\s+@default\(false\)/.test(skema)
    );

    // Berkas migrasi ditulis tangan dan TIDAK dijalankan: pemilik belum
    // memberi izin DDL untuk kolom ini.
    const folderMigrasi = resolve(__dirname, '../../prisma/migrations');
    const terahirTerpasang = '20261107192119_unit_pengunggah_konten_agenda';
    const calon = readdirSync(folderMigrasi)
      .filter((nama) => nama > terahirTerpasang)
      .filter((nama) => {
        const berkas = resolve(folderMigrasi, nama, 'migration.sql');
        return existsSync(berkas) && readFileSync(berkas, 'utf8').includes('pendingApproval');
      });
    uji('F3c tepat satu migrasi baru menambah kolom itu', calon.length === 1);

    uji(
      'F3d migrasinya hanya DDL tanpa UPDATE/INSERT/DELETE (baris lama otomatis false)',
      calon.length === 1 &&
        !/\b(UPDATE|INSERT|DELETE)\b/i.test(readFileSync(resolve(folderMigrasi, calon[0], 'migration.sql'), 'utf8')) &&
        /ALTER TABLE `ChatRoom` ADD COLUMN `pendingApproval`/.test(
          readFileSync(resolve(folderMigrasi, calon[0], 'migration.sql'), 'utf8')
        )
    );

    uji(
      'F3e createRoom menandai tertunda dari role penulis, bukan dari body, dan berkata jujur',
      /createRoom[\s\S]{0,900}?pendingApproval: ruangPerluPersetujuan\(req\.user\?\.role\)/.test(sumberChat) &&
        !/pendingApproval:\s*req\./.test(sumberChat) &&
        /menunggu persetujuan/.test(sumberChat)
    );

    uji(
      'F3f ruang tertutup belum dihitung membuka forum bila masih tertunda',
      /chatRoom\.count\(\{ where: \{ isOpen: true, pendingApproval: false \} \}\)/.test(sumberChat)
    );

    uji(
      'F3g daftar ruang menyembunyikan ruang tertunda kecuali dari pengelola & pembuatnya',
      /pendingApproval: false \}, \{ createdById: req\.user\.id \}\]/.test(sumberChat) &&
        /pendingApproval: ruang\.pendingApproval/.test(sumberChat)
    );

    uji(
      'F3h persetujuan rute baru: bolehKelolaRuang + logActivity, bukan perluasan setRoomStatus',
      /approveRoom[\s\S]{0,300}?if \(!bolehKelolaRuang\(req\.user\?\.role\)\)/.test(sumberChat) &&
        /approveRoom[\s\S]{0,900}?data: \{ pendingApproval: false \}/.test(sumberChat) &&
        /'APPROVE_CHAT_ROOM'/.test(sumberChat) &&
        /prisma\.chatRoom\.update\(\{ where: \{ id \}, data: \{ isOpen \} \}\)/.test(sumberChat)
    );

    uji(
      'F3i POST /rooms/:id/approve terdaftar dengan controller approveRoom',
      /router\.post\('\/rooms\/:id\/approve', approveRoom\)/.test(sumberRute) &&
        /\n  approveRoom,\n/.test(sumberRute)
    );

    uji(
      'F3j indeks lama [isOpen, createdAt] dibiarkan: kolom baru belum terbukti dipakai optimizer',
      /@@index\(\[isOpen, createdAt\]\)/.test(skema) && !/@@index\(\[[^\]]*pendingApproval/.test(skema)
    );
  }

  console.log('\n=== F4. Ruang tertunda tidak bisa dibaca/ditulis lewat id (AUDIT-19 G1) ===\n');

  {
    const sumberChat = bacaSumber('../controllers/chat.controller.ts');

    // Sama seperti F3a: require, bukan import, supaya RED berupa kegagalan
    // aturan bisnis dan bukan TS2305 yang menghentikan seluruh berkas.
    const chat = require('../controllers/chat.controller') as {
      ruangPerluPersetujuan?: (role: string | undefined) => boolean;
      ruangTertundaTerkunci?: (
        ruang: { pendingApproval: boolean; createdById: string },
        penonton: { id: string; role?: string }
      ) => boolean;
    };
    const kunci = chat.ruangTertundaTerkunci;

    uji(
      'F4a ruang tertunda terkunci bagi akun lain; pembuat & pengelola boleh masuk',
      kunci !== undefined &&
        kunci({ pendingApproval: true, createdById: 'a' }, { id: 'b', role: 'MAHASISWA' }) === true &&
        kunci({ pendingApproval: true, createdById: 'a' }, { id: 'b', role: 'PENGURUS_SISTEM_INFORMASI' }) === true &&
        kunci({ pendingApproval: true, createdById: 'a' }, { id: 'a', role: 'MAHASISWA' }) === false &&
        kunci({ pendingApproval: true, createdById: 'a' }, { id: 'b', role: 'PENGURUS_BEM' }) === false &&
        kunci({ pendingApproval: true, createdById: 'a' }, { id: 'b', role: 'ADMIN' }) === false &&
        kunci({ pendingApproval: false, createdById: 'a' }, { id: 'b', role: 'MAHASISWA' }) === false
    );

    uji(
      'F4b kedua jalur pesan membaca pendingApproval & createdById ruang',
      (sumberChat.match(/select: \{[^}]*pendingApproval: true[^}]*createdById: true/g) ?? []).length === 2
    );

    uji(
      'F4c penolakannya 404 dengan kalimat yang sama persis dengan "tidak ditemukan"',
      (
        sumberChat.match(
          /ruangTertundaTerkunci\([\s\S]{0,200}?res\.status\(404\)\.json\(\{ message: 'Ruang forum tidak ditemukan\.' \}\)/g
        ) ?? []
      ).length === 2
    );

    uji(
      'F4d penjaga berjalan sebelum riwayat dibaca dan sebelum pesan ditulis',
      (() => {
        const awal = sumberChat.indexOf('export const getMessages');
        const blok = sumberChat.slice(awal, sumberChat.indexOf('/** POST /api/chat/rooms/:id/messages', awal));
        const tulis = sumberChat.slice(sumberChat.indexOf('export const sendMessage'));
        return (
          awal > 0 &&
          blok.indexOf('ruangTertundaTerkunci') > blok.indexOf('if (!ruang)') &&
          blok.indexOf('ruangTertundaTerkunci') < blok.indexOf('prisma.chatMessage.findMany') &&
          tulis.indexOf('ruangTertundaTerkunci') > tulis.indexOf('if (!ruang)') &&
          tulis.indexOf('ruangTertundaTerkunci') < tulis.indexOf('prisma.chatMessage.create')
        );
      })()
    );

    uji(
      'F4e aturan isOpen lama utuh: 403 FORUM_BELUM_DIBUKA & ruang ditutup masih ada',
      /!ruang\.isOpen && !bolehKelolaRuang\(req\.user\?\.role\) && !\(await adaRuangTerbuka\(\)\)/.test(sumberChat) &&
        /code: 'FORUM_BELUM_DIBUKA'/.test(sumberChat) &&
        /if \(!ruang\.isOpen\) \{[\s\S]{0,120}?sudah ditutup oleh pengelola/.test(sumberChat)
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
