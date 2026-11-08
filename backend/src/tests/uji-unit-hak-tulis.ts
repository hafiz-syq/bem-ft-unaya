/**
 * Unit test hak tulis: siapa boleh menyiarkan apa, dan lewat limiter mana.
 *
 * Isinya dipindah utuh (tanpa perubahan perilaku) dari uji-unit-kritis.ts pada
 * ITERASI-AUDIT-19 G3 supaya berkas induk tetap di bawah plafon 800 baris dari
 * AGENTS.md. Yang dijaga:
 *   F2/K1-K14  hak tulis forum & pengumuman pengurus prodi + cermin FE.
 *   F1a-F1c    penulis ORGANISASI memilih organisasinya sendiri (AUDIT-19 F1).
 *   C1/C2      limiter per pengguna di jalur tulis yang menyiar ke banyak akun.
 *
 * Semua assert bersifat struktural (baca sumber) atau predikat murni — tidak ada
 * yang menyentuh database, kecuali penahan host baris pertama yang memastikan
 * DATABASE_URL tetap ke mesin lokal.
 *
 * Jalankan: npm run test:unit   (dari folder backend)
 */
import './penahan-host-uji';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cakupanButuhAdmin, layakDitampilkan } from '../controllers/announcement.controller';

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

async function main(): Promise<void> {
  console.log('\n=== F2. Hak tulis forum & pengumuman untuk pengurus prodi ===\n');

  {
    // Aturan akses ini tidak bisa dibuktikan lewat akun matriks (persona
    // "pengurus" di sana PENGURUS_BEM), jadi jangkar sumber yang menjaga:
    // siapa memakai predikat mana, dan bahwa hak kelola ruang tidak ikut meluas.
    const sumberChat = readFileSync(resolve(__dirname, '../controllers/chat.controller.ts'), 'utf8');
    const sumberUmum = readFileSync(resolve(__dirname, '../controllers/announcement.controller.ts'), 'utf8');

    uji(
      'K1 hanya POST /chat/rooms yang naik ke bolehBuatRuang; status, hapus ruang & filter kata tetap bolehKelolaRuang',
      /createRoom[\s\S]{0,200}?if \(!bolehBuatRuang\(req\.user\?\.role\)\)/.test(sumberChat) &&
        !/setRoomStatus[\s\S]{0,200}?bolehBuatRuang/.test(sumberChat) &&
        !/deleteRoom[\s\S]{0,200}?bolehBuatRuang/.test(sumberChat) &&
        !/saveForumFilter[\s\S]{0,200}?bolehBuatRuang/.test(sumberChat)
    );

    uji(
      'K2 daftar pembuat ruang prodi persis tiga pengurus prodi, tanpa PENGURUS generik / BEM / DPM',
      /ROLE_PEMBUAT_RUANG_PRODI = \['PENGURUS_SISTEM_INFORMASI', 'PENGURUS_TEKNIK_SIPIL', 'PENGURUS_TEKNIK_MESIN'\]/.test(
        sumberChat
      )
    );

    uji(
      'K3 tombol buat ruang & akses halaman forum memakai bolehBuatRuang, bukan bolehKelolaRuang',
      /const forumTerbuka = buat \|\| \(await adaRuangTerbuka\(\)\)/.test(sumberChat) &&
        /meta: \{ bolehMembuatRuang: buat, forumTerbuka: true \}/.test(sumberChat) &&
        /bolehMembuatRuang: bolehBuatRuang\(req\.user\?\.role\)/.test(sumberChat)
    );

    uji(
      'K4 create pengumuman terbuka untuk admin + pengurus; gerbang kasarnya satu fungsi',
      /const bolehTulisPengumuman = \(role: string\): boolean => isAdminRole\(role\) \|\| isOfficer\(role\)/.test(
        sumberUmum
      ) && /createAnnouncement[\s\S]{0,200}?if \(!bolehTulisPengumuman\(req\.user\.role\)\)/.test(sumberUmum)
    );

    uji(
      'K5 ubah & hapus pengumuman dibatasi lagi ke admin atau pembuatnya (createdById)',
      (sumberUmum.match(/isAdminRole\(req\.user\.role\) && lama\.createdById !== req\.user\.id/g) ?? []).length === 2
    );

    uji(
      'K6 ruang kelola /announcements/manage tetap hanya admin',
      /getManagedAnnouncements[\s\S]{0,250}?if \(!isAdminRole\(req\.user\.role\)\)/.test(sumberUmum)
    );

    uji(
      'K7 daftar pembaca mengirim punyaSaya sebagai penanda item milik sendiri',
      /punyaSaya: a\.createdById === req\.user\.id/.test(sumberUmum)
    );

    // B1 AUDIT-17: gerbang kasar K4 saja tidak cukup — audience dibaca dari
    // body, sehingga 6 pengurus bisa menyiarkan SEMUA/ROLE/ANGKATAN ke seluruh
    // akun aktif (notifikasi + web push). Yang dikunci di sini adalah fungsi
    // CAKUPAN, bukan hanya siapa yang boleh menulis.
    uji(
      'K8 siar menyeluruh (SEMUA/ROLE/ANGKATAN) dikhususkan admin lewat cakupanButuhAdmin',
      /export const cakupanButuhAdmin = \(audience: string\): boolean => audience !== 'ORGANISASI'/
        .test(sumberUmum) &&
        /!penulisAdmin && cakupanButuhAdmin\(audience\)[\s\S]{0,240}?res\.status\(403\)/.test(sumberUmum)
    );

    uji(
      'K8b cakupanButuhAdmin memisahkan siar menyeluruh dari ORGANISASI',
      cakupanButuhAdmin('SEMUA') &&
        cakupanButuhAdmin('ROLE') &&
        cakupanButuhAdmin('ANGKATAN') &&
        !cakupanButuhAdmin('ORGANISASI')
    );

    uji(
      'K9 organisasi penerima non-admin diturunkan dari jabatan aktif penulis, bukan dari body',
      /const idMilikPenulis = \(akun\?\.positions \?\? \[\]\)\.map/.test(sumberUmum) &&
        /idMilikPenulis\.includes\(idOrganisasi\)[\s\S]{0,160}?res\.status\(403\)/.test(sumberUmum) &&
        /audienceOrganizationId: audience === 'ORGANISASI' \? idOrganisasi : null/.test(sumberUmum)
    );

    // S2 AUDIT-17: hak "ubah/hapus punyanya sendiri" tidak ada gunanya kalau
    // item-nya tidak pernah muncul di daftar. Khalayak ROLE/ANGKATAN tidak
    // cocok dengan penulisnya dan draf tidak berstatus terbit.
    uji(
      'K10 daftar pembaca ikut mengambil item punya penulis sendiri di level query',
      /where: \{ OR: \[\{ isPublished: true \}, \{ createdById: req\.user\.id \}\] \}/.test(sumberUmum) &&
        /isPublished: a\.isPublished/.test(sumberUmum)
    );

    uji(
      'K11 penyaring daftar memakai layakDitampilkan, bukan hanya cocokUntukPengguna',
      /export const layakDitampilkan = \(/.test(sumberUmum) &&
        /layakDitampilkan\(a, \{/.test(sumberUmum)
    );

    {
      const penulis = { id: 'saya', role: 'PENGURUS_TEKNIK_SIPIL', nim: '240910001', positions: [] };
      const item = (over: Record<string, unknown>) => ({
        isPublished: true,
        createdById: 'lain',
        audience: 'SEMUA',
        audienceRole: null,
        audienceAngkatan: null,
        audienceOrganizationId: null,
        ...over,
      });
      uji(
        'K11b item milik sendiri selalu terbaca, draf & khalayak orang lain tidak',
        layakDitampilkan(item({ createdById: 'saya', isPublished: false }) as any, penulis) &&
          layakDitampilkan(item({ createdById: 'saya', audience: 'ROLE', audienceRole: 'MAHASISWA' }) as any, penulis) &&
          !layakDitampilkan(item({ isPublished: false }) as any, penulis) &&
          !layakDitampilkan(item({ audience: 'ROLE', audienceRole: 'MAHASISWA' }) as any, penulis)
      );
    }

    // CERMIN FE (AUDIT-17 S4/S5): daftar yang ditawarkan UI harus persis sama
    // dengan whitelist server. Selisih satu nilai saja sudah menjadi kegagalan
    // simpan tanpa alasan — itulah bug DPM/BEM yang baru ditutup, dan kelas
    // yang sama masih ada di dropdown role audience.
    const rolesFe = readFileSync(resolve(__dirname, '../../../frontend/src/lib/roles.ts'), 'utf8');
    const arrayLiteral = (sumber: string, nama: string): string[] => {
      const blok = sumber.match(new RegExp(`(?:export )?const ${nama}[^=]* = \\[([^\\]]*)\\]`));
      return blok ? (blok[1].match(/'[^']+'/g) ?? []).map((s) => s.replace(/'/g, '')) : [];
    };
    const himpunanSama = (a: string[], b: string[]): boolean =>
      a.length > 0 && a.length === b.length && a.every((x) => b.includes(x));

    uji(
      'K12 pilihan role audience FE = cermin ROLE_VALID backend',
      himpunanSama(arrayLiteral(rolesFe, 'AUDIENCE_ROLE_VALID'), arrayLiteral(sumberUmum, 'ROLE_VALID'))
    );

    uji(
      'K13 dropdown role memakai AUDIENCE_ROLE_VALID, bukan seluruh ROLE_LABEL',
      /AUDIENCE_ROLE_VALID\.map/.test(
        readFileSync(resolve(__dirname, '../../../frontend/src/pages/Announcements.tsx'), 'utf8')
      )
    );

    uji(
      'K14 unit konten FE = cermin KONTEN_UNITS backend',
      himpunanSama(
        arrayLiteral(rolesFe, 'KONTEN_UNITS'),
        arrayLiteral(readFileSync(resolve(__dirname, '../lib/ticket-access.ts'), 'utf8'), 'KONTEN_UNITS')
      )
    );

    // F1 AUDIT-19: non-admin boleh menyiarkan ke organisasinya sendiri, TAPI
    // tanpa id dari klien server dulu diam-diam memilih UUID pertama hasil
    // sort() — penulis multi-jabatan menyiar ke organisasi yang tidak ia pilih.
    // TODO F1 yang masih DIPARKAN (belum ada asser-nya, jangan mengaku lulus):
    // khalayak 'UNIT' dan peta ejaan program_studi -> unit. Nilainya belum
    // pernah disensus (staging mati), dan menebak ejaan = salah sasaran.
    uji(
      'F1a tidak ada organisasi arbitrer: tanpa id dari klien non-admin ditanya, bukan dipilihkan',
      !/= idMilikPenulis\[0\]/.test(sumberUmum) &&
        /if \(!idOrganisasi\) \{\s*res\.status\(400\)\.json\(\{ message: 'Pilih organisasi Anda\.' \}\)/.test(sumberUmum)
    );

    uji(
      'F1b /profile/me mengirim id organisasi jabatan supaya UI bisa menawarkan pilihan penulis',
      /idOrganisasi: p\.positionSlot\.organizationId/.test(
        readFileSync(resolve(__dirname, '../controllers/profile.controller.ts'), 'utf8')
      )
    );

    uji(
      'F1c FE menawarkan organisasi dari jabatan penulis & mengirim id terpilih',
      (() => {
        const halaman = readFileSync(resolve(__dirname, '../../../frontend/src/pages/Announcements.tsx'), 'utf8');
        return (
          /api\.get\('\/profile\/me'\)/.test(halaman) &&
          /data\.jabatan/.test(halaman) &&
          /audienceOrganizationId: segmenTerkirim === 'ORGANISASI' \? form\.audienceOrganizationId : undefined/.test(halaman)
        );
      })()
    );
  }

  console.log('\n=== C1. Laporan komentar ber-login punya limiter per pengguna ===\n');

  {
    // Rantainya yang diuji, bukan perilaku express-rate-limit (sudah terbukti
    // HTTP: laporan ke-11 dibalas 429 di staging). Dua assert sumber ini jatuh
    // kalau limiter itu dilepas atau berkuncinya dipindah kembali ke IP.
    const sumber = readFileSync(resolve(__dirname, '../routes/public-comment.routes.ts'), 'utf8');
    uji(
      'POST /:commentId/report memakai limiter setelah requireAuth dan sebelum controller',
      /router\.post\('\/:commentId\/report',\s*requireAuth,\s*batasLaporanLogin,\s*reportComment\)/.test(sumber)
    );
    uji(
      'limiter laporan login berkunci id pengguna, bukan IP kampus yang dibagi bersama',
      /batasLaporanLogin[\s\S]{0,400}keyGenerator: \(req: any\) => req\.user\?\.id \|\| ipKeyGenerator\(req\.ip\)/.test(sumber)
    );
  }

  console.log('\n=== C2. Jalur tulis yang menyiar ke banyak akun dibatasi per pengguna ===\n');

  {
    // Pembuatan pengumuman menyebarkan satu baris Notification + web push ke
    // sasaran (berikutnya), dan pembuatan ruang forum menulis beberapa baris
    // sekaligus. Tanpa limiter, satu skrip bisa membanjiri seluruh kampus lewat
    // jalur yang sudah terbukti sah. Yang diuji rantai rutenya plus kuncinya.
    const sumberUmumRute = readFileSync(resolve(__dirname, '../routes/announcement.routes.ts'), 'utf8');
    const sumberChatRute = readFileSync(resolve(__dirname, '../routes/chat.routes.ts'), 'utf8');

    uji(
      'K15 POST /announcements memakai limiter sebelum controller',
      /router\.post\('\/',\s*batasUmumLogin,\s*createAnnouncement\)/.test(sumberUmumRute)
    );
    uji(
      'K16 POST /chat/rooms memakai limiter sebelum controller',
      /router\.post\('\/rooms',\s*batasRuangLogin,\s*createRoom\)/.test(sumberChatRute)
    );
    uji(
      'K17 kedua limiter berkunci id pengguna, bukan IP kampus yang dibagi bersama',
      /batasUmumLogin[\s\S]{0,400}keyGenerator: \(req: any\) => req\.user\?\.id \|\| ipKeyGenerator\(req\.ip\)/.test(
        sumberUmumRute
      ) &&
        /batasRuangLogin[\s\S]{0,400}keyGenerator: \(req: any\) => req\.user\?\.id \|\| ipKeyGenerator\(req\.ip\)/.test(
          sumberChatRute
        )
    );
  }
  console.log(`\n--- RINGKASAN UNIT TEST HAK TULIS ---\nLulus: ${lulus}\nGagal: ${gagal.length}\n`);
  if (gagal.length > 0) {
    console.log('GAGAL:');
    gagal.forEach((g) => console.log(`  - ${g}`));
    process.exit(1);
  }
  console.log('HASIL: SEMUA UNIT TEST HAK TULIS LULUS');
}

main().catch((error) => {
  console.error('Unit test hak tulis gagal dijalankan:', error);
  process.exit(1);
});
