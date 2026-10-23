import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileDialogProvider } from './contexts/ProfileDialogContext';
import { ThemeProvider } from './contexts/ThemeContext';
import VercelAnalytics from './components/VercelAnalytics';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

const aplikasi = (
  <StrictMode>
    <HashRouter>
      {/* Web Analytics & Speed Insights Vercel. Mengikuti rute HashRouter,
          tidak merender elemen apa pun (aman untuk hidrasi prerender). */}
      <VercelAnalytics />
      <ThemeProvider>
        <AuthProvider>
          <ProfileDialogProvider>
            <App />
          </ProfileDialogProvider>
        </AuthProvider>
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