// Entry point untuk Vercel Services.
//
// Container Vercel menjalankan berkas ini sebagai proses server dan mengharapkan
// aplikasi mengikat port yang diberikan lewat environment variable PORT.
// Karena itu app.listen() harus aktif di sini — berbeda dari function serverless
// biasa yang hanya mengekspor app tanpa memanggil listen.
//
// Express app diambil dari hasil kompilasi TypeScript (backend/dist/app.js)
// yang sudah ikut di repository. Setelah mengubah kode backend, jalankan
// `npm run build` di folder backend agar dist/app.js ikut diperbarui.
const app = require('../../dist/app').default;

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BEM-FT UNAYA API listening on 0.0.0.0:${PORT}`);
});

module.exports = app;
