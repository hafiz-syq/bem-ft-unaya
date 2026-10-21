// Entry point serverless untuk Vercel.
//
// @vercel/node memanggil berkas ini sebagai handler, jadi app TIDAK boleh
// memanggil app.listen() di sini. Express app diambil dari hasil kompilasi
// TypeScript (backend/dist/app.js) yang sudah ikut di repository.
//
// Setelah mengubah kode backend, jalankan `npm run build` di folder backend
// agar dist/app.js ikut diperbarui.
const app = require('../../dist/app').default;

module.exports = app;
