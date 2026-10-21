// Launcher produksi untuk Hostinger / proses Node biasa.
//
// Vercel Services juga bisa mendeteksi package.json "main" ini. Karena service
// Express dijalankan sebagai Vercel Function, di Vercel cukup ekspor app tanpa
// membuka listener. Di Hostinger/proses Node biasa, listener tetap dijalankan.
require('dotenv').config();

const diVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

if (diVercel) {
  module.exports = require('./dist/app').default;
} else {
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
}
