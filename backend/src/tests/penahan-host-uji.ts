import 'dotenv/config';
import { NAMA_ENV_UJI, adalahHostLokal, optInDinyalakan, sembunyikanKredensial } from '../lib/penahan-host';

/**
 * Penahan host untuk SEMUA suite uji, bukan hanya matriks akses.
 *
 * Suite uji menulis (akun 999900xx) dan menghapus baris. Dua kali ia ikut menulis
 * ke produksi hanya karena bentuk perintah shell membuat proses tes tidak mewarisi
 * env staging, sementara backend/.env menunjuk Aiven. Karena itu pemeriksaan ini
 * berdiri sendiri di modul kecil yang diimpor baris pertama tiap titik masuk:
 * bantu-uji.ts, uji-unit-kritis.ts, dan uji-retensi-mysql.ts.
 *
 * Sengaja BUKAN di lib/prisma.ts — modul itu dipakai boot produksi dan lemparan di
 * sana membunuh seluruh rute /api (lihat riwayat FUNCTION_INVOCATION_FAILED).
 *
 * Default: DATABASE_URL yang menunjuk host jauh membuat proses keluar dengan kode 1.
 * Opt-in sadar: setel UJI_BOLEH_PRODUKSI=1. DATABASE_URL kosong dibiarkan, karena
 * job "statis" di CI berjalan tanpa basis data sama sekali (unit test murni).
 *
 * Keputusan host dan penyensoran kredensial diambil dari lib/penahan-host.ts,
 * modul yang sama dipakai jalur tulis non-tes — regex-nya tidak boleh diduplikasi.
 */
const urlUji = process.env.DATABASE_URL || '';

/** true bila URL menunjuk mesin ini; kosong dianggap aman (tidak ada yang bisa ditulis). */
export const hostLokal = adalahHostLokal(urlUji);

if (!hostLokal && !optInDinyalakan(process.env[NAMA_ENV_UJI])) {
  console.error(
    '\n[penahan uji] DATABASE_URL tidak menunjuk host lokal: ' +
      (sembunyikanKredensial(urlUji) || '(DATABASE_URL kosong)') +
      '\nSuite uji membuat, menghapus, atau memangkas baris di database tersebut.' +
      '\nJalankan dengan basis data staging, misalnya:' +
      '\n  DATABASE_URL="mysql://<user>@127.0.0.1:3306/<db-uji>" npm test' +
      '\nKalau memang sadar menargetkan database jauh, setel UJI_BOLEH_PRODUKSI=1.\n'
  );
  process.exit(1);
}
