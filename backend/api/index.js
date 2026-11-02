// Function masuk Vercel: semua permintaan (rewrites → /api/index) diteruskan ke
// app Express hasil build dist/app.js, tanpa listener (lihat src/index.ts).
//
// Berkas ini CommonJS karena backend/package.json memakai "type": "commonjs".
// Tidak boleh membaca .env: Vercel menyuntikkan variabel lingkungan sendiri.
const app = require('../dist/app').default;

module.exports = app;
