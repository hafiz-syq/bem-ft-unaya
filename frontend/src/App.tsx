import { Routes, Route, Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import FirstLogin from './pages/FirstLogin';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './layouts/DashboardLayout'; // Import Layout
import Profile from './pages/Profile';
import Students from './pages/Students';
import Tickets from './pages/Tickets';
import Organizations from './pages/Organizations';
import Positions from './pages/Positions';
import DataRequests from './pages/DataRequests';
import AuditLogs from './pages/AuditLogs';
import Landing from './pages/Landing';
import CMSManager from './pages/CMSManager';
import Agenda from './pages/Agenda';
import Gallery from './pages/Gallery';
import About from './pages/About';
import PublicContentDetail from './pages/PublicContentDetail';

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
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<Login />} />

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

      <Route path="/audit" element={
        <ProtectedRoute>
          <DashboardLayout>
            <AuditLogs />
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
      <Route path="/post/:id" element={<PublicContentDetail />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
