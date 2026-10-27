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
import './index.css';
// Dimuat SETELAH index.css agar aksen musiman menimpa utilitas Tailwind.
import './tema-musiman.css';

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

if (rootEl.hasChildNodes()) {
  // Prerender di build sudah menempelkan markup landing ke #root. React
  // mengambil alih markup itu tanpa merender ulang dari nol — konten tetap
  // tampak, semua fitur interaktif (menu, tema, form, dsb.) langsung hidup.
  hydrateRoot(rootEl, aplikasi);
} else {
  createRoot(rootEl).render(aplikasi);
}

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.setAttribute('lang', 'id');
}

// Service worker untuk PWA & notifikasi browser. Hanya didaftarkan di HTTPS
// atau localhost (syarat browser); kegagalan registrasi tidak mengganggu app.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker tidak terdaftar:', error);
    });
  });
}