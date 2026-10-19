import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/axios';
import {
  LayoutDashboard, Users, UserCheck, MessageSquare, AlertCircle, Clock, CheckCircle,
  Activity, Loader2, ShieldAlert, BarChart3, Timer, Inbox, UserMinus,
} from 'lucide-react';
import { isAdminRole, targetLabel } from '../lib/roles';
import AgendaCalendar from '../components/AgendaCalendar';

// Ringkasan penolakan permintaan dari origin web yang tidak dikenal.
// Hanya dikirim backend kepada ADMIN (lihat cors-monitor.service.ts).
interface OriginDitolak {
  origin: string;
  permintaan: number;
  terakhir: string;
}

interface KeamananCors {
  hari: number;
  kejadian: number;
  permintaan: number;
  originUnik: number;
  terakhir: string | null;
  teratas: OriginDitolak[];
  terpotong: boolean;
}

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
  keamananCors?: KeamananCors;
}

interface DeretGrafik {
  label: string;
  nilai: number;
}

interface Statistik {
  role: string;
  kartu: Record<string, number>;
  trenTiket: DeretGrafik[];
  distribusi?: DeretGrafik[];
  statusTiket?: DeretGrafik[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statistik, setStatistik] = useState<Statistik | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [res, resStatistik] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/statistik'),
        ]);
        setStats(res.data.data);
        setStatistik(resStatistik.data.data);
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

  const kartuStatistik = statistik?.kartu ?? {};
  const pengelola = user?.role !== 'MAHASISWA';

  const kartuTambahan = pengelola
    ? [
        { label: 'Rata-rata Respons', nilai: `${kartuStatistik.rataResponsJam ?? 0} jam`, icon: Timer },
        { label: 'Tiket Perlu Moderasi', nilai: kartuStatistik.tiketMenungguModerasi ?? 0, icon: Inbox },
        { label: 'Komentar Galeri Menunggu', nilai: kartuStatistik.menungguKomentarGaleri ?? 0, icon: MessageSquare },
        { label: 'Akun Nonaktif Menunggu Hapus', nilai: kartuStatistik.akunNonaktif ?? 0, icon: UserMinus },
      ]
    : [
        { label: 'Rata-rata Respons', nilai: `${kartuStatistik.rataResponsJam ?? 0} jam`, icon: Timer },
        { label: 'Tiket Ditanggapi', nilai: kartuStatistik.ditanggapi ?? 0, icon: CheckCircle },
        { label: 'Komentar Galeri Saya', nilai: kartuStatistik.totalKomentarGaleri ?? 0, icon: MessageSquare },
      ];

  const tren = statistik?.trenTiket ?? [];
  const maxTren = Math.max(1, ...tren.map((t) => t.nilai));
  const distribusi = statistik?.distribusi ?? [];
  const maxDistribusi = Math.max(1, ...distribusi.map((d) => d.nilai));

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
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100 sm:text-xl">
          <Activity className="w-5 h-5 text-amber-400"/> Ringkasan Statistik
        </h2>
      </div>

      {/* Tampilan Grid Berdasarkan Role */}
      {user?.role !== 'MAHASISWA' ? (
        // STATISTIK ADMIN & PENGURUS
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* [PERBAIKAN]: Menambahkan shrink-0 pada ikon, min-w-0 pada teks, dan truncate agar merespons sempurna */}
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0"><Users className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Total Mahasiswa</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.totalMahasiswa || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 rounded-lg shrink-0"><UserCheck className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Total Pengurus</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.totalPengurus || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg shrink-0"><Clock className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Tiket Menunggu</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.ticketMenunggu || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 rounded-lg shrink-0"><CheckCircle className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Tiket Selesai</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.ticketSelesai || 0}</p></div>
          </div>
        </div>
      ) : (
        // STATISTIK MAHASISWA
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0"><MessageSquare className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Total Aspirasi Saya</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.myAspirasi || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-lg shrink-0"><AlertCircle className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Total Keluhan Saya</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.myKeluhan || 0}</p></div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
            <div className="flex items-center justify-center w-12 h-12 text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg shrink-0"><Clock className="w-6 h-6"/></div>
            <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Tiket Sedang Diproses</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats?.myActiveTickets || 0}</p></div>
          </div>
        </div>
      )}

      {/* Kalender agenda tersinkron dengan CMS: kegiatan multi-hari tampil
          sebagai blok berwarna sesuai warna yang dipilih pengurus. */}
      <AgendaCalendar />

      {/* STATISTIK TAMBAHAN & GRAFIK (SEMUA ROLE) */}
      {statistik && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100 sm:text-xl">
              <BarChart3 className="w-5 h-5 text-amber-400" /> Statistik Aktivitas
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              {pengelola ? 'Angka layanan tiket, moderasi, dan siklus akun.' : 'Angka tiket dan komentar milik Anda.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kartuTambahan.map((kartu) => {
              const Icon = kartu.icon;
              return (
                <div key={kartu.label} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-5 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate">{kartu.label}</p>
                    <p className="text-lg font-black text-gray-900 dark:text-gray-100 truncate">{kartu.nilai}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Grafik batang tren tiket */}
            <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl lg:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  Tren Tiket {pengelola ? '12 Bulan' : '6 Bulan'} Terakhir
                </h3>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  Total: {tren.reduce((a, b) => a + b.nilai, 0)}
                </span>
              </div>

              <div className="flex items-end gap-1 h-40 sm:gap-2">
                {tren.map((t) => (
                  <div key={t.label} className="flex flex-col items-center flex-1 min-w-0 h-full gap-1 group">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.nilai > 0 ? t.nilai : ''}</span>
                    <div className="flex items-end w-full h-full">
                      <div
                        role="img"
                        aria-label={`${t.label}: ${t.nilai} tiket`}
                        title={`${t.label}: ${t.nilai} tiket`}
                        style={{ height: `${Math.max(3, (t.nilai / maxTren) * 100)}%` }}
                        className="w-full transition-all duration-500 rounded-t-md bg-amber-400 hover:bg-amber-500 dark:bg-amber-500/80 dark:hover:bg-amber-400"
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribusi / status */}
            <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
              <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-100">
                {pengelola ? 'Tiket per Organisasi Tujuan' : 'Status Tiket Saya'}
              </h3>

              {pengelola ? (
                distribusi.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada tiket dalam 12 bulan terakhir.</p>
                ) : (
                  <ul className="space-y-3">
                    {distribusi.slice(0, 5).map((d) => (
                      <li key={d.label}>
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                          <span className="truncate">{d.label === 'TIDAK_DITENTUKAN' ? 'Tidak ditentukan' : targetLabel(d.label)}</span>
                          <span className="shrink-0">{d.nilai}</span>
                        </div>
                        <div className="h-2 mt-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div style={{ width: `${(d.nilai / maxDistribusi) * 100}%` }} className="h-full rounded-full bg-amber-400" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <ul className="space-y-2">
                  {(statistik.statusTiket ?? []).length === 0 ? (
                    <li className="text-sm text-gray-500 dark:text-gray-400">Belum ada tiket.</li>
                  ) : (
                    (statistik.statusTiket ?? []).map((s) => (
                      <li key={s.label} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-600 dark:text-gray-400">{s.label}</span>
                        <span className="font-black text-gray-900 dark:text-gray-100">{s.nilai}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Ringkasan keamanan: percobaan akses dari origin web tak dikenal. */}
      {isAdminRole(user?.role) && stats?.keamananCors && (
        <section className="pt-2 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100 sm:text-xl">
              <ShieldAlert className="w-5 h-5 text-amber-400" /> Keamanan: Akses Lintas Origin
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              Permintaan {stats.keamananCors.hari} hari terakhir yang ditolak karena datang dari origin tidak dikenal.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
              <div className="flex items-center justify-center w-12 h-12 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded-lg shrink-0"><ShieldAlert className="w-6 h-6"/></div>
              <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Permintaan Ditolak</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats.keamananCors.permintaan}</p></div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
              <div className="flex items-center justify-center w-12 h-12 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0"><AlertCircle className="w-6 h-6"/></div>
              <div className="min-w-0"><p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Origin Unik</p><p className="text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">{stats.keamananCors.originUnik}</p></div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm sm:p-6 rounded-xl">
              <div className="flex items-center justify-center w-12 h-12 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0"><Clock className="w-6 h-6"/></div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate sm:text-sm">Percobaan Terakhir</p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 truncate sm:text-base">
                  {stats.keamananCors.terakhir ? new Date(stats.keamananCors.terakhir).toLocaleString('id-ID') : 'Tidak ada'}
                </p>
              </div>
            </div>
          </div>

          {stats.keamananCors.teratas.length > 0 ? (
            <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                      <th className="p-4 font-medium">Origin</th>
                      <th className="p-4 font-medium">Permintaan</th>
                      <th className="p-4 font-medium">Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {stats.keamananCors.teratas.map((item) => (
                      <tr key={item.origin} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-4 font-mono text-xs break-all text-gray-900 dark:text-gray-100 sm:text-sm">{item.origin}</td>
                        <td className="p-4 font-bold text-gray-900 dark:text-gray-100">{item.permintaan}</td>
                        <td className="p-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(item.terakhir).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-3 text-xs border-t border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                Origin di sini belum terdaftar sebagai alamat resmi. Tambahkan ke FRONTEND_URLS hanya bila memang dikenal.
                {stats.keamananCors.terpotong && ' Angka ini batas bawah karena catatan sudah sangat banyak.'}
              </p>
            </div>
          ) : (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
              Belum ada percobaan akses dari origin tidak dikenal. Bagus.
            </div>
          )}
        </section>
      )}

    </div>
  );
}