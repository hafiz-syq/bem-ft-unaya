// Launcher produksi untuk Hostinger / proses Node biasa.
//
// Vercel juga bisa mendeteksi package.json "main" ini. Saat Vercel mengimpor
// berkas ini sebagai function, cukup ekspor app tanpa listener. Saat dijalankan
// langsung dengan `node server.js` (Hostinger), listener tetap dinyalakan.
require('dotenv').config();

if (require.main === module) {
  process.env.BEM_START_LISTENER = '1';

  const fs = require('fs');
  const path = require('path');
  const entry = path.join(__dirname, 'dist', 'index.js');

  if (!fs.existsSync(entry)) {
    console.error(
      '[server] dist/index.js belum ada. Jalankan "npm run build" di folder backend, lalu restart aplikasi.'
    );
    process.exit(1);
  }

  // Path literal agar file tracing Vercel ikut membawa seluruh isi dist/.
  require('./dist/index.js');
} else {
  module.exports = require('./dist/app').default;
}
