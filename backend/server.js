// Launcher produksi untuk Hostinger / proses Node biasa.
//
// Vercel Services memakai src/controllers/index.js sebagai entrypoint, sedangkan
// Hostinger (dan `npm start`) memakai berkas ini. Keduanya harus menjalankan
// aplikasi Express yang sama, bukan server demo.
//
// Muat .env lebih dulu, lalu jalankan hasil kompilasi TypeScript. Server hasil
// build sudah membaca process.env.PORT dan mengikat port tersebut.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const entry = path.join(__dirname, 'dist', 'index.js');

if (!fs.existsSync(entry)) {
  console.error(
    '[server] dist/index.js belum ada. Jalankan "npm run build" di folder backend, lalu restart aplikasi.'
  );
  process.exit(1);
}

require(entry);
