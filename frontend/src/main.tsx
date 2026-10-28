import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileDialogProvider } from './contexts/ProfileDialogContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { SeasonalThemeProvider } from './contexts/SeasonalThemeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import VercelAnalytics from './components/VercelAnalytics';
import { pasangPemantauKoneksi } from './lib/offline';
import './index.css';
// Dimuat SETELAH index.css agar aksen musiman menimpa utilitas Tailwind.
import './tema-musiman.css';

// Pemantau koneksi & antrean offline dipasang sekali untuk seluruh aplikasi.
pasangPemantauKoneksi();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

const aplikasi = (
  <StrictMode>
    <HashRouter>
      {/* Web Analytics & Speed Insights Vercel. Mengikuti rute HashRouter,
          tidak merender elemen apa pun (aman untuk hidrasi prerender). */}
      <VercelAnalytics />
      <ThemeProvider>
        <SeasonalThemeProvider>
          <AuthProvider>
            {/* Status online: hijau di avatar pengguna yang sedang membuka situs. */}
            <PresenceProvider>
              <ProfileDialogProvider>
                <App />
              </ProfileDialogProvider>
            </PresenceProvider>
          </AuthProvider>
        </SeasonalThemeProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>
);

// Prerender di build hanya mengisi markup LANDING. Bila pengguna membuka
// rute lain langsung (mis. /#/dashboard atau reload saat offline), hidrasi
// markup landing tersebut akan menghasilkan error mismatch React. Karena itu
// hidrasi hanya dilakukan ketika rute awalnya memang landing; rute lain
// dirender dari klien seperti biasa.
const ruteAwal = window.location.hash;
const mulaiDariLanding = ruteAwal === '' || ruteAwal === '#' || ruteAwal === '#/';

if (rootEl.hasChildNodes() && mulaiDariLanding) {
  // React mengambil alih markup landing tanpa merender ulang dari nol — konten
  // tetap tampak, semua fitur interaktif (menu, tema, form, dsb.) langsung hidup.
  hydrateRoot(rootEl, aplikasi);
} else {
  // Buang markup prerender yang tidak cocok dengan rute awal.
  rootEl.innerHTML = '';
  createRoot(rootEl).render(aplikasi);
}

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.setAttribute('lang', 'id');
}

// Service worker untuk PWA, mode offline, dan notifikasi browser. Hanya
// didaftarkan pada build produksi (HTTPS/localhost) supaya HMR saat `npm run dev`
// tidak terganggu cache aset. Kegagalan registrasi tidak mengganggu aplikasi.
if (
  typeof window !== 'undefined' &&
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  window.isSecureContext
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker tidak terdaftar:', error);
    });
  });
}