// Launcher Express untuk proses Node biasa (Hostinger/lokal).
//
// Vercel Services memakai src/app.ts, karena service Express dijalankan sebagai
// Vercel Function: runtime mengimpor app dan menangani request sendiri, tanpa
// perlu app.listen(). Membuka listener di function membuat inisialisasi gagal
// dengan FUNCTION_INVOCATION_FAILED.
//
// Express app diambil dari hasil kompilasi TypeScript (backend/dist/app.js)
// yang sudah ikut di repository. Setelah mengubah kode backend, jalankan
// `npm run build` di folder backend agar dist/app.js ikut diperbarui.
const app = require('../../dist/app').default;

// Vercel menjalankan service Express sebagai Vercel Function. Runtime-nya
// mengimpor app dan menangani request sendiri, jadi JANGAN membuka listener di
// proses function: app.listen() di sini membuat inisialisasi function gagal
// (FUNCTION_INVOCATION_FAILED). Cukup ekspor app.
//
// Listener tetap dipakai untuk Hostinger/proses Node biasa lewat server.js.
const diVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

if (!diVercel) {
  const PORT = process.env.PORT || 8080;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BEM-FT UNAYA API listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
