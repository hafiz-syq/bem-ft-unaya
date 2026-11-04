import 'dotenv/config';
import path from 'path';
import { NAMA_ENV_TULIS, adalahHostLokal, optInDinyalakan, sembunyikanKredensial } from '../lib/penahan-host';

/**
 * Penahan untuk jalur TULIS non-tes: skrip di src/scripts dan preflight
 * `prisma migrate dev` / `prisma db push`.
 *
 * Suite uji sudah punya penahan sendiri (src/tests/penahan-host-uji.ts). Yang ini
 * menjaga perintah yang membuat akun, mengisi seed, atau mengubah skema: tanpa
 * guard, satu perintah shell yang khilaf menulis ke Aiven karena backend/.env
 * default-nya memang menunjuk produksi — dan `prisma migrate dev` recreate serta
 * `db push` bisa menjatuhkan kolom di jalur itu.
 *
 * Sengaja TIDAK dipasang di npm run prisma:deploy (jalur produksi yang sah sesuai
 * rel kerja) dan tidak di lib/prisma.ts (boot produksi; lemparan di sana membunuh
 * seluruh rute /api — lihat riwayat FUNCTION_INVOCATION_FAILED di penahan uji).
 *
 * Default: host jauh membuat proses keluar dengan kode 1 sebelum query pertama.
 * Opt-in sadar: setel TULIS_BOLEH_JAUH=1. DATABASE_URL kosong dibiarkan, karena
 * tidak ada yang bisa ditulis dan job statis CI menjalankannya tanpa basis data.
 */
const urlTulis = process.env.DATABASE_URL || '';

if (!adalahHostLokal(urlTulis) && !optInDinyalakan(process.env[NAMA_ENV_TULIS])) {
  const asal = process.argv[2] || path.basename(process.argv[1] || 'skrip');
  console.error(
    `\n[penahan tulis] ${asal} tidak dijalankan: DATABASE_URL menunjuk host jauh: ` +
      sembunyikanKredensial(urlTulis) +
      '\nPerintah ini membuat, mengubah, atau menghapus baris, dan backend/.env' +
      '\ndefault-nya menunjuk produksi (Aiven). Arahkan ke staging lokal, misalnya:' +
      '\n  DATABASE_URL="mysql://<user>@127.0.0.1:3306/<db-uji>" <perintah yang sama>' +
      `\nKalau memang sadar menargetkan database jauh, setel ${NAMA_ENV_TULIS}=1.\n`
  );
  process.exit(1);
}
