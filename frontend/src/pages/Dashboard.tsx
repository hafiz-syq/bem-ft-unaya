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
    return <div className="flex justify-center items-center h-[70vh]"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>;
  }

  return (
    <div className="p-6 mx-auto space-y-6 md:p-8 max-w-7xl">
      
      {/* Header Ucapan Selamat Datang */}
      <div className="relative p-8 overflow-hidden text-white shadow-lg bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl">
        <div className="relative z-10">
          <h1 className="mb-2 text-3xl font-black">Selamat Datang, {user?.nim}!</h1>
          <p className="max-w-2xl text-lg text-amber-100">
            {user?.role === 'MAHASISWA' 
              ? 'Ini adalah portal resmi BEM-FT UNAYA. Sampaikan aspirasi dan keluhan Anda untuk Fakultas Teknik yang lebih baik.'
              : 'Pantau aktivitas dan statistik layanan tiket BEM-FT UNAYA secara real-time dari panel kontrol ini.'}
          </p>
        </div>
        <LayoutDashboard className="absolute w-48 h-48 text-white right-4 -bottom-4 opacity-10" />
      </div>

      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
          <Activity className="w-5 h-5 text-amber-400"/> Ringkasan Statistik
        </h2>
      </div>

      {/* Tampilan Grid Berdasarkan Role */}
      {user?.role !== 'MAHASISWA' ? (
        // STATISTIK ADMIN & PENGURUS
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 bg-blue-100 rounded-lg"><Users className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Total Mahasiswa</p><p className="text-2xl font-black text-gray-900">{stats?.totalMahasiswa || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-purple-600 bg-purple-100 rounded-lg"><UserCheck className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Total Pengurus</p><p className="text-2xl font-black text-gray-900">{stats?.totalPengurus || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 bg-yellow-100 rounded-lg"><Clock className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Tiket Menunggu</p><p className="text-2xl font-black text-gray-900">{stats?.ticketMenunggu || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-green-600 bg-green-100 rounded-lg"><CheckCircle className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Tiket Selesai</p><p className="text-2xl font-black text-gray-900">{stats?.ticketSelesai || 0}</p></div>
          </div>
        </div>
      ) : (
        // STATISTIK MAHASISWA
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 bg-blue-100 rounded-lg"><MessageSquare className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Total Aspirasi Saya</p><p className="text-2xl font-black text-gray-900">{stats?.myAspirasi || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-red-600 bg-red-100 rounded-lg"><AlertCircle className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Total Keluhan Saya</p><p className="text-2xl font-black text-gray-900">{stats?.myKeluhan || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-6 bg-white border border-gray-100 shadow-sm rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 bg-yellow-100 rounded-lg"><Clock className="w-6 h-6"/></div>
            <div><p className="text-sm font-bold text-gray-500">Tiket Sedang Diproses</p><p className="text-2xl font-black text-gray-900">{stats?.myActiveTickets || 0}</p></div>
          </div>
        </div>
      )}
      
    </div>
  );
}