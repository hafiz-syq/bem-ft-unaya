/**
 * Bukti SQL penomoran tiket (B2.6) dieksekusi di mesin sebenarnya.
 *
 * Unit test kelompok E hanya membuktikan derivasi string lewat stub $queryRaw,
 * jadi pernyataan SQL `MAX(CAST(SUBSTRING_INDEX(ticket_no,'-',-1) AS UNSIGNED))`
 * sendiri belum pernah dijalankan di mana pun. Skrip ini menanam 0001/0002/0004
 * (0003 sengaja tidak ada — itulah keadaan sesudah satu hard delete), memanggil
 * fungsi aslinya, lalu menuntut 0005. Sebagai bonus ia membuktikan penjaga
 * sebenarnya: membuat tiket bernomor 0004 yang sudah terpakai harus P2002.
 *
 * Pintu masuknya SAMA dengan controller (nomorTiketBerikutnya diimpor dari
 * ticket.controller.ts), jadi bukti ini tidak bisa berbeda dari kode produksi.
 *
 * Jalankan: npm run uji:nomor-tiket   (khusus database sekali-pakai, mis. job CI)
 */
import './penahan-host-uji';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { nomorTiketBerikutnya } from '../controllers/ticket.controller';

const NIM_UJI = 'NOMR000001';
const PESAN_UJI = 'baris uji penomoran tiket';
const HARI = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const AWALAN = `TKT-${HARI}-`;
const NOMOR_UJI = ['0001', '0002', '0004'].map((n) => `${AWALAN}${n}`);

const cacat: string[] = [];
const cek = (nama: string, kondisi: boolean, lanjut = '') => {
  console.log(`  ${kondisi ? 'LULUS' : 'GAGAL'}   ${nama}${kondisi ? '' : '  ' + lanjut}`);
  if (!kondisi) cacat.push(nama);
};

async function bersih(): Promise<void> {
  await prisma.ticket.deleteMany({ where: { ticket_no: { in: NOMOR_UJI } } });
  await prisma.user.deleteMany({ where: { nim: NIM_UJI } });
}

async function main(): Promise<void> {
  // Menolak lebih dulu, SEBELUM ada baris yang dihapus: di database yang berisi data,
  // deleteMany di bawah bisa menyapu tiket orang lain yang kebetulan bernomor
  // 0001/0002/0004 hari ini, dan MAX yang dihasilkan pun bukan 4 lagi.
  const asing = await prisma.ticket.count({
    where: { ticket_no: { startsWith: AWALAN }, NOT: { content: PESAN_UJI } },
  });
  if (asing !== 0) {
    console.error(
      `[uji nomor tiket] Database ini memuat ${asing} tiket berawalan ${AWALAN} yang bukan baris uji. ` +
        'Jalankan langkah ini hanya di database sekali-pakai (mis. service mysql di CI), bukan di ' +
        'staging yang berisi data.'
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  await bersih();
  const akun = await prisma.user.create({
    data: { nim: NIM_UJI, password_hash: 'bukan-hash-asli-uji-nomor', role: Role.MAHASISWA },
  });
  await prisma.ticket.createMany({
    data: NOMOR_UJI.map((no) => ({
      ticket_no: no,
      type: 'ASPIRASI',
      category: 'FASILITAS',
      title: no,
      content: PESAN_UJI,
      senderId: akun.id,
    })),
  });

  console.log('\n--- UJI PENOMORAN TIKET DI MESIN SEBENARNYA ---');
  const hasil = await nomorTiketBerikutnya(prisma, HARI);
  cek(`MAX hari itu = 0004 (0003 hilang) -> nomor berikutnya 0005`, hasil === `${AWALAN}0005`, `(hasil=${hasil})`);

  // Rumus lama: count hari itu + 1. Kalau ini 4, rumus lama pasti melahirkan 0004
  // yang sudah terpakai — persis tabrakan yang bikin semua tiket 409 sampai UTC tengah malam.
  const jumlah = await prisma.ticket.count({ where: { ticket_no: { startsWith: AWALAN } } });
  const nomorLama = `${AWALAN}${String(jumlah + 1).padStart(4, '0')}`;
  cek(`rumus lama (count+1) masih menghasilkan nomor daur ulang ${AWALAN}0004`, nomorLama === `${AWALAN}0004`, `(count=${jumlah} -> ${nomorLama})`);

  let tabrakan: string | undefined;
  try {
    await prisma.ticket.create({
      data: {
        ticket_no: `${AWALAN}0004`,
        type: 'ASPIRASI',
        category: 'FASILITAS',
        title: 'uji tabrakan',
        content: 'harus ditolak unique constraint',
        senderId: akun.id,
      },
    });
  } catch (e) {
    tabrakan = (e as { code?: string }).code;
  }
  cek('unique constraint ticket_no benar-benar menjaga: 0004 kedua -> P2002 (409)', tabrakan === 'P2002', `(kode=${tabrakan ?? 'TIDAK DITOLAK'})`);

  await bersih();
  cek(
    'semua baris uji dibersihkan',
    (await prisma.ticket.count({ where: { ticket_no: { startsWith: AWALAN } } })) === 0 &&
      (await prisma.user.count({ where: { nim: NIM_UJI } })) === 0
  );

  console.log(`\nLulus: ${4 - cacat.length}  Gagal: ${cacat.length}`);
  if (cacat.length > 0) {
    console.log('GAGAL:');
    cacat.forEach((c) => console.log(`  - ${c}`));
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('HASIL: SQL PENOMORAN TIKET BENAR DI MESIN INI');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[uji nomor tiket] GAGAL BERJALAN:', (e as Error)?.message || e);
  await bersih().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
