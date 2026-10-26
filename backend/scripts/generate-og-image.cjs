/**
 * Sekali jalan: membuat frontend/public/og-image.png (1200×630) untuk kartu
 * bagikan Open Graph / WhatsApp / Twitter dari foto fakultas yang sudah ada.
 *
 * Jalankan dari folder backend (butuh sharp):
 *   node scripts/generate-og-image.cjs
 *
 * Bila judul atau warna mau diubah, sunting SVG di bawah lalu jalankan ulang;
 * hasilnya langsung tertimpa di frontend/public/og-image.png.
 */
const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SUMBER = path.join(ROOT, 'frontend', 'public', 'fakultas-teknik.webp');
const TUJUAN = path.join(ROOT, 'frontend', 'public', 'og-image.png');

const svg = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
  <defs>
    <linearGradient id="tirai" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0b0b0f" stop-opacity="0.94"/>
      <stop offset="55%" stop-color="#0b0b0f" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#0b0b0f" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="bawah" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b0b0f" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0b0b0f" stop-opacity="0.85"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#tirai)"/>
  <rect width="1200" height="630" fill="url(#bawah)"/>

  <rect x="72" y="212" width="8" height="216" rx="4" fill="#fbbf24"/>

  <text x="104" y="272" fill="#ffffff" font-size="72" font-weight="bold" letter-spacing="1">BEM FT UNAYA</text>
  <text x="104" y="318" fill="#d1d5db" font-size="30">Portal Resmi Fakultas Teknik</text>
  <text x="104" y="356" fill="#d1d5db" font-size="30">Universitas Abulyatama</text>

  <rect x="104" y="390" width="330" height="46" rx="23" fill="#fbbf24" fill-opacity="0.16" stroke="#fbbf24" stroke-opacity="0.7"/>
  <text x="128" y="420" fill="#fbbf24" font-size="22" font-weight="600">Aspirasi · Agenda · Galeri · Tiket</text>

  <text x="104" y="566" fill="#9ca3af" font-size="24">bem-ft-unaya.vercel.app</text>
  <circle cx="1128" cy="86" r="10" fill="#fbbf24"/>
</svg>
`);

sharp(SUMBER)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .composite([{ input: svg, top: 0, left: 0 }])
  .png({ compressionLevel: 9 })
  .toFile(TUJUAN)
  .then((info) => console.log('OG image dibuat:', TUJUAN, JSON.stringify(info)))
  .catch((err) => {
    console.error('Gagal membuat OG image:', err);
    process.exit(1);
  });
