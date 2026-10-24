import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';

// Halaman selain landing dimuat sesuai kebutuhan. Ini memangkas JavaScript
// awal yang harus diunduh pengunjung, sehingga halaman publik tampil lebih
// cepat terutama di jaringan kampus/HP.
const Login = lazy(() => import('./pages/Login'));
const LupaPassword = lazy(() => import('./pages/LupaPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const FirstLogin = lazy(() => import('./pages/FirstLogin'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Profile = lazy(() => import('./pages/Profile'));
const Students = lazy(() => import('./pages/Students'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetail = lazy(() => import('./pages/DeviceDetail'));
const Tickets = lazy(() => import('./pages/Tickets'));
const Organizations = lazy(() => import('./pages/Organizations'));
const Positions = lazy(() => import('./pages/Positions'));
const DataRequests = lazy(() => import('./pages/DataRequests'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const CMSManager = lazy(() => import('./pages/CMSManager'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Gallery = lazy(() => import('./pages/Gallery'));
const About = lazy(() => import('./pages/About'));
const PublicContentDetail = lazy(() => import('./pages/PublicContentDetail'));
const PublicComments = lazy(() => import('./pages/PublicComments'));
const Faq = lazy(() => import('./pages/Faq'));
const Demisioner = lazy(() => import('./pages/Demisioner'));
const GalleryCommentsAdmin = lazy(() => import('./pages/GalleryCommentsAdmin'));
const SeasonalTheme = lazy(() => import('./pages/SeasonalTheme'));

/** Tampilan sementara saat potongan halaman sedang diunduh. */
function MemuatHalaman() {
  return (
    <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
      <span className="w-10 h-10 border-4 rounded-full border-amber-200 border-t-amber-500 animate-spin" />
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}

/**
 * Penjaga dasar: hanya memastikan pengguna sudah login.
 * Dipakai halaman first-login & verifikasi email, yang justru HARUS bisa dibuka
 * oleh pengguna yang datanya belum lengkap.
 */
function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

/**
 * Penjaga halaman aplikasi: selain sudah login, pengguna juga harus sudah
 * mengganti password bawaan (first_login selesai) dan sudah memverifikasi
 * emailnya. Pengguna yang belum punya email tidak ditahan, karena tidak ada
 * yang bisa diverifikasi.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.first_login) return <Navigate to="/first-login" replace />;
  if (user.email && !user.email_verified) return <Navigate to="/verify-email" replace />;

  return children;
}

function App() {
  useEffect(() => {
    // Mark as hydrated after mount to ensure client-side JS takes over
    // This prevents React hydration mismatch warnings
  }, []);

  return (
    <Suspense fallback={<MemuatHalaman />}>
      <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<Login />} />
      <Route path="/lupa-password" element={<LupaPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/first-login" element={
        <AuthOnlyRoute>
          <FirstLogin />
        </AuthOnlyRoute>
      } />

      <Route path="/verify-email" element={
        <AuthOnlyRoute>
          <VerifyEmail />
        </AuthOnlyRoute>
      } />

      {/* Rute-rute yang dibungkus oleh DashboardLayout */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Profile />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/tickets" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Tickets />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/students" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Students />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/devices" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Devices />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Riwayat perangkat satu akun, tempat admin memutus satu perangkat saja. */}
      <Route path="/devices/:id" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DeviceDetail />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Pengaturan tema musiman: halaman menolak sendiri bila bukan SUPERADMIN. */}
      <Route path="/tema-musiman" element={
        <ProtectedRoute>
          <DashboardLayout>
            <SeasonalTheme />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/buku-tamu" element={
        <ProtectedRoute>
          <DashboardLayout>
            <PublicComments />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/organizations" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Organizations />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/positions" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Positions />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/data-requests" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DataRequests />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/galeri-komentar" element={
        <ProtectedRoute>
          <DashboardLayout>
            <GalleryCommentsAdmin />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/audit" element={
        <ProtectedRoute>
          <DashboardLayout>
            <AuditLogs />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/faq" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Faq />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/cms" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CMSManager />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/agenda" element={<Agenda />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/about" element={<About />} />
      <Route path="/demisioner" element={<Demisioner />} />
      <Route path="/post/:id" element={<PublicContentDetail />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
