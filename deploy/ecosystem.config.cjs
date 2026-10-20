/**
 * Konfigurasi PM2 untuk API di VM produksi.
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * Sesuaikan `cwd` bila repo tidak di-clone ke /opt/bem-ft-unaya.
 * Variabel rahasia (DATABASE_URL, JWT_SECRET, SMTP_*, dll.) dibaca dari
 * backend/.env oleh `dotenv/config`; jangan ditulis di berkas ini.
 */
module.exports = {
  apps: [
    {
      name: 'bem-ft-api',
      cwd: '/opt/bem-ft-unaya/backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '450M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // API berada di belakang Caddy: pakai IP asli dari X-Forwarded-For.
        TRUST_PROXY: '1',
      },
    },
  ],
};
