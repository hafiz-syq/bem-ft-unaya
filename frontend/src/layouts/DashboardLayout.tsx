import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/axios';
import { LogOut, Menu, LayoutDashboard, Users, MessageSquareWarning, UserCircle, UserPlus, FileEdit, Activity, Bell, Check, Globe, Home } from 'lucide-react';

interface Notification {
  id: string; title: string; message: string; isRead: boolean; createdAt: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State Notifikasi
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data.data);
      } catch (error) { console.error(error); }
    };
    fetchNotifs();

    // Auto-refresh notif setiap 30 detik (opsional tapi bagus untuk real-time feel)
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) { console.error(error); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['MAHASISWA', 'PENGURUS', 'ADMIN'] },
    { name: 'Profil Saya', path: '/profile', icon: UserCircle, roles: ['MAHASISWA', 'PENGURUS', 'ADMIN'] },
    { name: 'Perubahan Data', path: '/data-requests', icon: FileEdit, roles: ['MAHASISWA', 'PENGURUS', 'ADMIN'] },
    { name: 'Layanan Tiket', path: '/tickets', icon: MessageSquareWarning, roles: ['MAHASISWA', 'PENGURUS', 'ADMIN'] },
    { name: 'Data Mahasiswa', path: '/students', icon: Users, roles: ['PENGURUS', 'ADMIN'] },
    { name: 'Master Organisasi', path: '/organizations', icon: Users, roles: ['ADMIN'] },
    { name: 'Kepengurusan', path: '/positions', icon: UserPlus, roles: ['ADMIN'] },
    { name: 'Audit Log', path: '/audit', icon: Activity, roles: ['ADMIN'] },
    { name: 'Konten Web Publik', path: '/cms', icon: Globe, roles: ['ADMIN', 'PENGURUS'] },
  ];

  const allowedMenus = menuItems.filter(item => item.roles.includes(user?.role || ''));
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    // [PERBAIKAN] Menambahkan w-full dan overflow-x-hidden untuk mencegah bocor ke samping
    <div className="flex w-full min-h-screen overflow-x-hidden bg-gray-50">
      
      {/* Sidebar Desktop */}
      <aside className="fixed z-10 flex-col hidden w-64 h-full bg-white border-r border-gray-200 md:flex">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-black tracking-tight text-gray-900">BEM-FT UNAYA</h1>
          <p className="text-xs font-medium text-gray-500">Portal Resmi Mahasiswa</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {allowedMenus.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${isActive ? 'bg-amber-400 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <Icon className="w-5 h-5 shrink-0" /> {item.name}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-3 mx-4 mb-4 text-sm font-bold text-gray-700 transition-all border border-gray-200 rounded-lg shadow-sm bg-gray-50 hover:bg-amber-100 hover:text-amber-700"
        >
          <Home className="w-5 h-5 shrink-0" />
          Lihat Halaman Utama
        </Link>
        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center w-full gap-3 px-4 py-3 text-sm font-bold text-red-600 transition rounded-xl hover:bg-red-50">
            <LogOut className="w-5 h-5 shrink-0" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      {/* [PERBAIKAN] Menambahkan min-w-0 agar elemen didalam flex tidak memaksakan lebarnya */}
      <div className="flex flex-col flex-1 w-full min-w-0 min-h-screen md:ml-64">

        {/* Header / Topbar */}
        <header className="sticky top-0 z-50 flex items-center justify-between w-full px-3 py-3 bg-white border-b border-gray-200 shadow-sm sm:px-4 md:px-6">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative z-50 inline-flex items-center justify-center text-gray-700 transition rounded-lg w-9 h-9 sm:w-10 sm:h-10 md:hidden hover:bg-gray-100 shrink-0"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h2 className="hidden text-lg font-bold text-gray-800 capitalize truncate sm:block">
              {location.pathname.replace('/', '').replace('-', ' ')}
            </h2>

            {/* Tombol mobile: Kembali + Keluar */}
            {/* [PERBAIKAN] Gap dan ukuran di hemat, teks hanya tampil di layar lebih besar (sm:block) */}
            <div className="flex items-center gap-1 sm:gap-2 md:hidden">
              <Link to="/" className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold text-gray-600 rounded-lg hover:bg-gray-100 transition shrink-0">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M15 6l-6 6 6 6"/></svg>
                <span className="hidden sm:inline-block">Kembali</span>
              </Link>
              <button onClick={handleLogout} className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold text-red-600 rounded-lg hover:bg-red-50 transition shrink-0">
                <LogOut className="w-4 h-4 shrink-0" /> 
                <span className="hidden sm:inline-block">Keluar</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Tombol Notifikasi */}
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 text-gray-500 transition rounded-full hover:bg-gray-100 shrink-0">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>

            {/* Dropdown Notifikasi */}
            {isNotifOpen && (
              <div className="absolute z-50 overflow-hidden bg-white border border-gray-100 shadow-xl top-12 right-2 w-[85vw] max-w-[280px] rounded-xl">
                <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-900">Notifikasi</h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAsRead} className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-5 00"><Check className="w-3 h-3 shrink-0" /> Tandai</button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[55vh]">
                  {notifications.length === 0 ? (
                    <div className="p-5 text-sm text-center text-gray-500">Tidak ada notifikasi.</div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 transition ${notif.isRead ? 'opacity-60' : 'bg-blue-50/30'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${notif.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{notif.title}</p>
                          {!notif.isRead && <span className="flex-shrink-0 w-2 h-2 mt-1 rounded-full bg-amber-400"></span>}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString('id-ID')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* [PERBAIKAN] Mengurangi jarak padding kiri (pl) pada layar kecil */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 sm:gap-3 sm:pl-4 shrink-0">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-tight text-gray-900">{user?.nim}</p>
                <p className="text-xs font-bold uppercase text-amber-400">{user?.role}</p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 text-xs font-bold text-white rounded-full shadow-md shrink-0 bg-amber-400 sm:w-9 sm:h-9 sm:text-base">
                {user?.nim.substring(0, 2)}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
          style={{ opacity: isMobileMenuOpen ? 1 : 0, transition: 'opacity 200ms ease-in-out', pointerEvents: isMobileMenuOpen ? 'auto' : 'none' }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="absolute top-0 left-0 flex flex-col w-64 h-full overflow-y-auto bg-white shadow-2xl md:hidden"
            style={{ transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 shrink-0">
              <h1 className="text-xl font-black">Menu Navigasi</h1>
            </div>
            
            <nav className="p-4 space-y-1.5 flex-1">
              {allowedMenus.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-colors ${isActive ? 'bg-amber-400 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Icon className="w-5 h-5 shrink-0" /> {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* [PERBAIKAN] Tambahan menu footer untuk versi mobile agar konsisten dengan desktop */}
            <div className="p-4 space-y-2 border-t border-gray-200 shrink-0 bg-gray-50">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center w-full gap-3 px-4 py-3 text-sm font-bold text-gray-700 transition bg-white border border-gray-200 shadow-sm rounded-xl hover:bg-amber-100 hover:text-amber-700"
              >
                <Home className="w-5 h-5 shrink-0" /> Lihat Utama
              </Link>
              <button 
                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                className="flex items-center w-full gap-3 px-4 py-3 text-sm font-bold text-red-600 transition bg-white border border-red-100 shadow-sm rounded-xl hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 shrink-0" /> Keluar
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}