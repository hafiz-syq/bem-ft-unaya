// Preflight untuk jalur CLI yang tidak melewati berkas .ts sendiri (prisma migrate
// dev / db push). npm script tidak bisa mengimpor modul, jadi entri satu baris ini
// yang memuat penahan; argv[2] dipakai apa adanya sebagai label di pesan galat.
// npm run -T: entry polos yang tidak mengimpor modul bertype Node tidak diberi
// @types/node oleh ts-node (penahan-host-uji.ts lama gagal sama saat dipakai sebagai
// entry), sementara type-check berkas ini tetap dijaga gerbang `npx tsc --noEmit`.
import './penahan-host-tulis';
