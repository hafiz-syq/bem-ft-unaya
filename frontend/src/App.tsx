import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import OfflineStatus from './components/OfflineStatus';
import Landing from './pages/Landing';
import MemuatHalaman from './components/MemuatHalaman';
import { isAdminRole, isStaff, ROLE_SUPERADMIN } from './lib/roles';

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
const PasangAplikasiHalaman = lazy(() => import('./pages/PasangAplikasi'));
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
const Forum = lazy(() => import('./pages/Forum'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Documents = lazy(() => import('./pages/Documents'));
const ErrorLogs = lazy(() => import('./pages/ErrorLogs'));
const Faq = lazy(() => import('./pages/Faq'));
const Demisioner = lazy(() => import('./pages/Demisioner'));
const GalleryCommentsAdmin = lazy(() => import('./pages/GalleryCommentsAdmin'));
const SeasonalTheme = lazy(() => import('./pages/SeasonalTheme'));

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

/**
 * ProtectedRoute + pemeriksaan role. Sidebar hanya menyembunyikan menu,
 * URL-nya tetap bisa dibuka langsung, jadi penolakannya ditaruh di rute.
 * Aturan sebenarnya tetap dijaga server.
 */
function RequireRole({ boleh, children }: { boleh: (role?: string | null) => boolean; children: ReactNode }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {boleh(user?.role) ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
}

const isSuperAdmin = (role?: string | null) => role === ROLE_SUPERADMIN;

function App() {
  useEffect(() => {
    // Mark as hydrated after mount to ensure client-side JS takes over
    // This prevents React hydration mismatch warnings
  }, []);

  return (
    <>
      {/* Indikator offline & sinkronisasi, global untuk semua halaman. */}
      <OfflineStatus />
      {/* Batas ini hanya untuk potongan layout/rute terluar. Ganti halaman di
          dalam dashboard ditangani Suspense milik DashboardLayout, supaya menu
          samping tidak ikut tercabut saat chunk halaman diunduh. */}
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
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <Devices />
          </DashboardLayout>
        </RequireRole>
      } />

      {/* Riwayat perangkat satu akun, tempat admin memutus satu perangkat saja. */}
      <Route path="/devices/:id" element={
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <DeviceDetail />
          </DashboardLayout>
        </RequireRole>
      } />

      {/* Pengaturan tema musiman: rute menolak non-SUPERADMIN, halaman memeriksa ulang. */}
      <Route path="/tema-musiman" element={
        <RequireRole boleh={isSuperAdmin}>
          <DashboardLayout>
            <SeasonalTheme />
          </DashboardLayout>
        </RequireRole>
      } />

      {/* Forum diskusi: semua akun login boleh membaca & menulis; pembuatan
          ruang dibatasi BEM/DPM/admin di sisi server. */}
      <Route path="/forum" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Forum />
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

      <Route path="/pengumuman" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Announcements />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/dokumen" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Documents />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/pemantauan" element={
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <ErrorLogs />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/organizations" element={
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <Organizations />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/positions" element={
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <Positions />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/data-requests" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DataRequests />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/galeri-komentar" element={
        <RequireRole boleh={isStaff}>
          <DashboardLayout>
            <GalleryCommentsAdmin />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/audit" element={
        <RequireRole boleh={isAdminRole}>
          <DashboardLayout>
            <AuditLogs />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/faq" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Faq />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Cara pasang portal sebagai aplikasi (PWA) untuk semua akun login. */}
      <Route path="/pasang-aplikasi" element={
        <ProtectedRoute>
          <DashboardLayout>
            <PasangAplikasiHalaman />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      <Route path="/cms" element={
        <RequireRole boleh={isStaff}>
          <DashboardLayout>
            <CMSManager />
          </DashboardLayout>
        </RequireRole>
      } />

      <Route path="/agenda" element={<Agenda />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/about" element={<About />} />
      <Route path="/demisioner" element={<Demisioner />} />
      <Route path="/post/:id" element={<PublicContentDetail />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
