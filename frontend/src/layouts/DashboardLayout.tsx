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
    <div className="flex min-h-screen bg-gray-50">
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
                <Icon className="w-5 h-5" /> {item.name}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-3 mb-4 text-sm font-bold text-gray-700 transition-all border border-gray-200 rounded-lg shadow-sm bg-gray-50 hover:bg-amber-100 hover:text-amber-700"
        >
          <Home className="w-5 h-5" />
          Lihat Halaman Utama
        </Link>
        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center w-full gap-3 px-4 py-3 text-sm font-bold text-red-600 transition rounded-xl hover:bg-red-50">
            <LogOut className="w-5 h-5" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen md:ml-64">

        {/* Header / Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 md:hidden"><Menu className="w-6 h-6" /></button>
            <h2 className="hidden text-lg font-bold text-gray-800 capitalize sm:block">
              {location.pathname.replace('/', '').replace('-', ' ')}
            </h2>
          </div>

          <div className="relative flex items-center gap-4">
            {/* Tombol Notifikasi */}
            <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative p-2 text-gray-500 transition rounded-full hover:bg-gray-100">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>

            {/* Dropdown Notifikasi */}
            {isNotifOpen && (
              <div className="absolute z-50 overflow-hidden bg-white border border-gray-100 shadow-2xl top-12 right-12 w-80 rounded-xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-bold text-gray-900">Notifikasi</h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAsRead} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"><Check className="w-3 h-3" /> Tandai dibaca</button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-80">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-sm text-center text-gray-500">Tidak ada notifikasi.</div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition ${notif.isRead ? 'opacity-60' : 'bg-blue-50/30'}`}>
                        <div className="flex items-start justify-between mb-1">
                          <p className={`text-sm ${notif.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{notif.title}</p>
                          {!notif.isRead && <span className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></span>}
                        </div>
                        <p className="text-xs text-gray-500">{notif.message}</p>
                        <p className="text-[10px] text-gray-400 mt-2">{new Date(notif.createdAt).toLocaleString('id-ID')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-tight text-gray-900">{user?.nim}</p>
                <p className="text-xs font-bold uppercase text-amber-400">{user?.role}</p>
              </div>
              <div className="flex items-center justify-center font-bold text-white rounded-full shadow-md bg-amber-400 w-9 h-9">
                {user?.nim.substring(0, 2)}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-64 h-full bg-white" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200"><h1 className="text-xl font-black">Menu Navigasi</h1></div>
              <nav className="p-4 space-y-2">
                {allowedMenus.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 rounded-xl hover:bg-gray-100">
                      <Icon className="w-5 h-5" /> {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}