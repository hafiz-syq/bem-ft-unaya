import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/axios';
import { LayoutDashboard, Users, UserCheck, MessageSquare, AlertCircle, Clock, CheckCircle, Activity, Loader2 } from 'lucide-react';

// Mendefinisikan tipe data yang jelas pengganti "any"
interface DashboardStats {
  totalMahasiswa?: number;
  totalPengurus?: number;
  totalAspirasi?: number;
  totalKeluhan?: number;
  ticketMenunggu?: number;
  ticketDiproses?: number;
  ticketSelesai?: number;
  myTickets?: number;
  myAspirasi?: number;
  myKeluhan?: number;
  myActiveTickets?: number;
  myCompletedTickets?: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data.data);
      } catch (error) {
        // Menggunakan variabel error agar terbaca oleh sistem log dan menghilangkan warning
        console.error('Gagal memuat statistik:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-[70vh]"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>;
  }

  return (
    // [PERBAIKAN]: Menambahkan w-full, overflow-x-hidden, dan mengecilkan padding mobile (p-4)
    <div className="w-full p-4 mx-auto space-y-6 overflow-x-hidden max-w-7xl sm:p-6 md:p-8">
      
      {/* Header Ucapan Selamat Datang */}
      {/* [PERBAIKAN]: Mengecilkan padding banner di mobile (p-6) */}
      <div className="relative p-6 overflow-hidden text-white shadow-lg sm:p-8 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl">
        <div className="relative z-10">
          {/* [PERBAIKAN]: Menyesuaikan ukuran font dan menambahkan break-words agar teks panjang tidak merusak layout */}
          <h1 className="mb-2 text-2xl font-black break-words sm:text-3xl">Selamat Datang, {user?.nim}!</h1>
          {/* [PERBAIKAN]: Menyesuaikan teks paragraf untuk layar kecil */}
          <p className="max-w-2xl text-sm sm:text-base md:text-lg text-amber-100">
            {user?.role === 'MAHASISWA' 
              ? 'Ini adalah portal resmi BEM-FT UNAYA. Sampaikan aspirasi dan keluhan Anda untuk Fakultas Teknik yang lebih baik.'
              : 'Pantau aktivitas dan statistik layanan tiket BEM-FT UNAYA secara real-time dari panel kontrol ini.'}
          </p>
        </div>
        <LayoutDashboard className="absolute right-0 w-40 h-40 text-white pointer-events-none sm:w-48 sm:h-48 sm:right-4 -bottom-4 opacity-10" />
      </div>

      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 sm:text-xl">
          <Activity className="w-5 h-5 text-amber-400"/> Ringkasan Statistik
        </h2>
      </div>

      {/* Tampilan Grid Berdasarkan Role */}
      {user?.role !== 'MAHASISWA' ? (
        // STATISTIK ADMIN & PENGURUS
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* [PERBAIKAN]: Menambahkan shrink-0 pada ikon, min-w-0 pada teks, dan truncate agar merespons sempurna */}
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 bg-blue-100 rounded-lg shrink-0"><Users className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Total Mahasiswa</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.totalMahasiswa || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-purple-600 bg-purple-100 rounded-lg shrink-0"><UserCheck className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Total Pengurus</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.totalPengurus || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 bg-yellow-100 rounded-lg shrink-0"><Clock className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Tiket Menunggu</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.ticketMenunggu || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-green-600 bg-green-100 rounded-lg shrink-0"><CheckCircle className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Tiket Selesai</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.ticketSelesai || 0}</p></div>
          </div>
        </div>
      ) : (
        // STATISTIK MAHASISWA
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 bg-blue-100 rounded-lg shrink-0"><MessageSquare className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Total Aspirasi Saya</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.myAspirasi || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-red-600 bg-red-100 rounded-lg shrink-0"><AlertCircle className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Total Keluhan Saya</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.myKeluhan || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 bg-yellow-100 rounded-lg shrink-0"><Clock className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 truncate sm:text-sm">Tiket Sedang Diproses</p><p className="text-xl font-black text-gray-900 sm:text-2xl">{stats?.myActiveTickets || 0}</p></div>
          </div>
        </div>
      )}
      
    </div>
  );
}