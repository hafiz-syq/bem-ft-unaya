/**
 * Verifikasi 5 pernyataan retensi (B2.7) di MySQL 8, bukan MariaDB.
 *
 * Angka B2.7 dulu diukur di MariaDB 10.4, sedangkan produksi berjalan di MySQL 8.4.
 * `DELETE ... LIMIT` dan `UPDATE ... LIMIT` tanpa ORDER BY adalah soal per mesin
 * (binlog format & perencana), jadi langkah ini menanam baris berpenanda di kedua
 * sisi ambang, memangkas sekali, lalu membuktikan yang hilang persis yang tua.
 *
 * Penahan host lokal diimpor lebih dulu (baris pertama) dan ikut dipakai lewat
 * bantu-uji.ts: skrip ini MENGHAPUS baris,
 * sehingga DATABASE_URL yang bocor ke produksi harus menghentikan sebelum query apa pun.
 *
 * Jalankan: npm run uji:retensi  (sengaja membaca RETENSI_AKTIF; hanya di DB sekali-pakai)
 */
import './penahan-host-uji';
import './bantu-uji';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import {
  HARI_AUDIT,
  HARI_ERROR_LOG,
  HARI_JEJAK_TAMU,
  HARI_NOTIFIKASI,
  HARI_PESAN_CHAT,
  pangkasRetensi,
} from '../services/retensi.service';

const PENANDA = 'UJI-RETENSI';
const NIM_UJI = 'RETN000001';
const TUA = (hari: number) => new Date(Date.now() - (hari + 10) * 86_400_000);
const MUDA = (hari: number) => new Date(Date.now() - Math.max(hari - 10, 1) * 86_400_000);
const TUA_T = 3;
const MUDA_T = 2;

const cacat: string[] = [];
const cek = (nama: string, kondisi: boolean, lanjut = '') => {
  console.log(`  ${kondisi ? 'LULUS' : 'GAGAL'}   ${nama}${kondisi ? '' : '  ' + lanjut}`);
  if (!kondisi) cacat.push(nama);
};

async function bersih() {
  await prisma.galleryComment.deleteMany({ where: { content: { startsWith: PENANDA } } });
  await prisma.auditLog.deleteMany({ where: { action: PENANDA } });
  await prisma.errorLog.deleteMany({ where: { message: { startsWith: PENANDA } } });
  await prisma.notification.deleteMany({ where: { title: PENANDA } });
  await prisma.chatMessage.deleteMany({ where: { content: { startsWith: PENANDA } } });
  await prisma.gallery.deleteMany({ where: { title: PENANDA } });
  await prisma.chatRoom.deleteMany({ where: { name: PENANDA } });
  await prisma.user.deleteMany({ where: { nim: NIM_UJI } });
}

async function main(): Promise<void> {
  if ((process.env.RETENSI_AKTIF || '').trim() !== '1') {
    console.error(
      '[uji retensi] Langkah ini menguji jalur RETENSI_AKTIF=1. Nyalakan flag itu hanya di database sekali-pakai, mis. di CI.'
    );
    process.exit(1);
  }

  await bersih();
  const akun = await prisma.user.create({
    data: { nim: NIM_UJI, password_hash: 'bukan-hash-asli-uji-retensi', role: Role.MAHASISWA },
  });
  const galeri = await prisma.gallery.create({
    data: { title: PENANDA, category: 'FOTO', url: 'https://penanda.invalid/x', year: 2026, uploaderId: akun.id },
  });
  const ruang = await prisma.chatRoom.create({
    data: { name: PENANDA, createdById: akun.id },
  });

  // Baris berpenanda, separuh di luar ambang (harus hilang) separuh di dalam (harus sisa).
  await prisma.notification.createMany({
    data: [
      ...Array(TUA_T).fill(0).map(() => ({ userId: akun.id, title: PENANDA, message: 'tua', createdAt: TUA(HARI_NOTIFIKASI) })),
      ...Array(MUDA_T).fill(0).map(() => ({ userId: akun.id, title: PENANDA, message: 'muda', createdAt: MUDA(HARI_NOTIFIKASI) })),
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      ...Array(TUA_T).fill(0).map(() => ({ action: PENANDA, entityType: 'Uji', description: 'tua', createdAt: TUA(HARI_AUDIT) })),
      ...Array(MUDA_T).fill(0).map(() => ({ action: PENANDA, entityType: 'Uji', description: 'muda', createdAt: MUDA(HARI_AUDIT) })),
    ],
  });
  await prisma.errorLog.createMany({
    data: [
      ...Array(TUA_T).fill(0).map(() => ({ message: `${PENANDA} tua`, method: 'GET', path: '/uji-retensi', createdAt: TUA(HARI_ERROR_LOG) })),
      ...Array(MUDA_T).fill(0).map(() => ({ message: `${PENANDA} muda`, method: 'GET', path: '/uji-retensi', createdAt: MUDA(HARI_ERROR_LOG) })),
    ],
  });
  await prisma.chatMessage.createMany({
    data: [
      ...Array(TUA_T).fill(0).map(() => ({ roomId: ruang.id, authorId: akun.id, content: `${PENANDA} tua`, createdAt: TUA(HARI_PESAN_CHAT) })),
      ...Array(MUDA_T).fill(0).map(() => ({ roomId: ruang.id, authorId: akun.id, content: `${PENANDA} muda`, createdAt: MUDA(HARI_PESAN_CHAT) })),
    ],
  });
  await prisma.galleryComment.createMany({
    data: [
      ...Array(TUA_T).fill(0).map(() => ({ galleryId: galeri.id, content: `${PENANDA} tua`, guestName: 'tamu', guestIp: '203.0.113.1', guestUserAgent: 'uji', createdAt: TUA(HARI_JEJAK_TAMU) })),
      ...Array(MUDA_T).fill(0).map(() => ({ galleryId: galeri.id, content: `${PENANDA} muda`, guestName: 'tamu', guestIp: '203.0.113.2', guestUserAgent: 'uji', createdAt: MUDA(HARI_JEJAK_TAMU) })),
    ],
  });

  // Hitungan seluruh tabel SEBELUM pangkas: selisihnya harus sama persis dengan
  // angka yang dilaporkan service, apa pun isi database di luar baris uji ini.
  const sebelum = {
    notifikasi: await prisma.notification.count(),
    auditLog: await prisma.auditLog.count(),
    errorLog: await prisma.errorLog.count(),
    pesanChat: await prisma.chatMessage.count(),
    jejakTamu: await prisma.galleryComment.count({ where: { guestIp: { not: null } } }),
  };

  const hasil = await pangkasRetensi();

  const sesudah = {
    notifikasi: await prisma.notification.count(),
    auditLog: await prisma.auditLog.count(),
    errorLog: await prisma.errorLog.count(),
    pesanChat: await prisma.chatMessage.count(),
    jejakTamu: await prisma.galleryComment.count({ where: { guestIp: { not: null } } }),
  };

  console.log('\n--- UJI RETENSI DI MESIN SEBENARNYA ---');
  console.log('lapor service :', JSON.stringify(hasil));
  console.log('hilang sebenarnya:', JSON.stringify({
    notifikasi: sebelum.notifikasi - sesudah.notifikasi,
    auditLog: sebelum.auditLog - sesudah.auditLog,
    errorLog: sebelum.errorLog - sesudah.errorLog,
    pesanChat: sebelum.pesanChat - sesudah.pesanChat,
    jejakTamu: sebelum.jejakTamu - sesudah.jejakTamu,
  }));

  const tabel: [string, keyof typeof sebelum, number][] = [
    ['Notification (180 hari)', 'notifikasi', TUA_T],
    ['AuditLog (365 hari)', 'auditLog', TUA_T],
    ['ErrorLog (90 hari)', 'errorLog', TUA_T],
    ['ChatMessage (365 hari)', 'pesanChat', TUA_T],
    ['GalleryComment jejak tamu (365 hari)', 'jejakTamu', TUA_T],
  ];
  for (const [nama, kunci, harus] of tabel) {
    const hilang = sebelum[kunci] - sesudah[kunci];
    cek(`${nama}: baris hilang = ${harus} baris tua`, hilang === harus, `(hilang=${hilang})`);
    cek(`${nama}: service melaporkan jumlah yang sama`, hasil[kunci] === hilang, `(lapor=${hasil[kunci]}, hilang=${hilang})`);
  }

  // Baris muda tidak boleh tersentuh, dan komentar tuanya tetap ada (hanya PII-nya hilang).
  cek(
    'Notification muda tetap ada',
    (await prisma.notification.count({ where: { title: PENANDA } })) === MUDA_T
  );
  cek(
    'AuditLog muda tetap ada',
    (await prisma.auditLog.count({ where: { action: PENANDA } })) === MUDA_T
  );
  cek(
    'ErrorLog muda tetap ada',
    (await prisma.errorLog.count({ where: { message: { startsWith: PENANDA } } })) === MUDA_T
  );
  cek(
    'ChatMessage muda tetap ada',
    (await prisma.chatMessage.count({ where: { content: { startsWith: PENANDA } } })) === MUDA_T
  );
  const komentarTua = await prisma.galleryComment.findMany({
    where: { content: { startsWith: `${PENANDA} tua` } },
    select: { guestIp: true },
  });
  cek(
    'komentar tua TIDAK dihapus barisnya, hanya jejak tamunya yang dinolkan',
    komentarTua.length === TUA_T && komentarTua.every((k) => k.guestIp === null)
  );
  cek(
    'komentar muda masih menyimpan jejak tamunya',
    (await prisma.galleryComment.count({
      where: { content: { startsWith: `${PENANDA} muda` }, guestIp: { not: null } },
    })) === MUDA_T
  );

  await bersih();
  cek(
    'semua baris uji dibersihkan',
    (await prisma.user.count({ where: { nim: NIM_UJI } })) === 0 &&
      (await prisma.galleryComment.count({ where: { content: { startsWith: PENANDA } } })) === 0
  );

  console.log(`\nLulus: ${TUA_T * 2 * tabel.length + 6 - cacat.length}  Gagal: ${cacat.length}`);
  if (cacat.length > 0) {
    console.log('GAGAL:');
    cacat.forEach((c) => console.log(`  - ${c}`));
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('HASIL: RETENSI BERJALAN BENAR DI MESIN INI');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[uji retensi] GAGAL BERJALAN:', e?.message || e);
  await bersih().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
