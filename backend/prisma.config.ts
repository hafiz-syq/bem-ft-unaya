/**
 * Berkas konfigurasi Prisma CLI.
 *
 * Catatan: proyek ini masih memakai Prisma 5.22, yang belum mengenal berkas
 * `prisma.config.ts` maupun helper `definePrismaConfig` dari paket `prisma/config`
 * (keduanya baru ada di Prisma 6.7+/7). Karena itu isinya ditulis sebagai objek
 * biasa tanpa impor supaya tetap lolos pemeriksaan TypeScript, dan konfigurasi
 * yang benar-benar dipakai CLI tetap berasal dari `prisma/schema.prisma` +
 * `DATABASE_URL` di `.env`.
 *
 * Setelah proyek naik ke Prisma 7, ganti bagian ini menjadi:
 *   import { defineConfig } from 'prisma/config';
 *   export default defineConfig({ skills: { agents: [...] } });
 */
export default {
  skills: {
    agents: ['claude', 'cursor', 'agents', 'devin'],
  },
};
