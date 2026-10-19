import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import { Clock, MapPin, Link as LinkIcon, Loader2, Code2, ArrowLeft, Share2, Lock, CalendarDays, CalendarPlus, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { isMahasiswaOrAbove } from '../lib/roles';
import { formatRentangTanggal, jumlahHariAgenda } from '../lib/tanggal';

interface AgendaItem {
  id: string; title: string; description: string; date: string; endDate: string | null; color: string | null;
  time: string; location: string; registrationLink: string | null; socialMediaLink: string | null;
}

const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Tanggal agenda dalam bentuk "YYYY-MM-DD" (tanpa pergeseran zona waktu). */
const kunciTanggal = (iso: string): string => String(iso).slice(0, 10);

/** Item berlangsung pada tanggal tertentu bila rentangnya (date..endDate) memuatnya. */
const memuatTanggal = (item: AgendaItem, kunci: string): boolean =>
  kunciTanggal(item.date) <= kunci && kunci <= kunciTanggal(item.endDate || item.date);

export default function Agenda() {
  const { user } = useAuth();
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Kalender bulanan -------------------------------------------------
  // Navigasi bulan berawal dari bulan berjalan; klik tanggal menyaring
  // daftar agenda di bawah menjadi hanya yang berlangsung tanggal itu.
  const hariIni = new Date();
  const [bulanTampil, setBulanTampil] = useState({ y: hariIni.getFullYear(), m: hariIni.getMonth() });
  const [hariTerpilih, setHariTerpilih] = useState<string | null>(null);

  useEffect(() => {
    api.get('/cms/agendas')
      .then(res => setAgendas(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  /** 42 sel kalender (6 minggu, Senin sebagai awal) untuk bulan yang tampil. */
  const gridKalender = useMemo(() => {
    const pertama = new Date(bulanTampil.y, bulanTampil.m, 1);
    const geser = (pertama.getDay() + 6) % 7; // Senin = 0
    const mulai = new Date(bulanTampil.y, bulanTampil.m, 1 - geser);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(mulai);
      d.setDate(mulai.getDate() + i);
      return d;
    });
  }, [bulanTampil]);

  /** Peta kunci "YYYY-MM-DD" → agenda yang berlangsung pada tanggal itu. */
  const agendaPerTanggal = useMemo(() => {
    const peta = new Map<string, AgendaItem[]>();
    for (const tampil of gridKalender) {
      const kunci = kunciTanggal(tampil.toISOString());
      const isi = agendas.filter(item => memuatTanggal(item, kunci));
      peta.set(kunci, isi);
    }
    return peta;
  }, [agendas, gridKalender]);

  /** Agenda di daftar bawah: bila tanggal dipilih, hanya yang berlangsung itu. */
  const agendaTampil = useMemo(() => {
    if (!hariTerpilih) return agendas;
    return agendas.filter(item => memuatTanggal(item, hariTerpilih));
  }, [agendas, hariTerpilih]);

  const geserBulan = (arah: number) => {
    const baru = new Date(bulanTampil.y, bulanTampil.m + arah, 1);
    setBulanTampil({ y: baru.getFullYear(), m: baru.getMonth() });
    setHariTerpilih(null);
  };

  return (
    <div className="min-h-screen font-sans bg-gray-50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform bg-amber-400 rounded-lg shadow-lg group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900 dark:text-gray-100">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4"/> Kembali</Link>
        <ThemeToggle />
      </nav>

      <main className="max-w-5xl px-6 py-12 mx-auto">
        <div className="mb-10 text-center">
          <h2 className="mb-4 text-4xl font-black text-gray-900 dark:text-gray-100">Agenda & Kegiatan</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400">Jadwal acara, seminar, dan kegiatan himpunan mahasiswa Teknik.</p>
        </div>

        {/* ---- KALENDER BULANAN ---- */}
        <div className="mb-10 overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <button onClick={() => geserBulan(-1)} aria-label="Bulan sebelumnya" className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {NAMA_BULAN[bulanTampil.m]} {bulanTampil.y}
            </h3>
            <button onClick={() => geserBulan(1)} aria-label="Bulan berikutnya" className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {NAMA_HARI.map(h => (
              <div key={h} className="py-2 text-center text-xs font-bold uppercase text-gray-400">{h}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {gridKalender.map((tampil, i) => {
              const kunci = kunciTanggal(tampil.toISOString());
              const isi = agendaPerTanggal.get(kunci) || [];
              const diLuar = tampil.getMonth() !== bulanTampil.m;
              const hariSekarang = kunci === kunciTanggal(hariIni.toISOString());
              const terpilih = hariTerpilih === kunci;
              return (
                <button
                  key={kunci}
                  onClick={() => setHariTerpilih(terpilih ? null : kunci)}
                  aria-label={`Tanggal ${tampil.getDate()} ${NAMA_BULAN[tampil.getMonth()]}${isi.length > 0 ? `, ${isi.length} agenda` : ''}`}
                  className={`relative min-h-[68px] p-2 text-left border-b border-r border-gray-100 dark:border-gray-800 transition-colors ${
                    terpilih ? 'bg-amber-50 dark:bg-amber-900/30' :
                    diLuar ? 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50' :
                    'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  } ${i % 7 === 6 ? 'border-r-0' : ''} ${i >= 35 ? 'border-b-0' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full ${
                    hariSekarang ? 'bg-amber-400 text-gray-900' : ''
                  }`}>{tampil.getDate()}</span>
                  {isi.length > 0 && (
                    <span className="absolute bottom-1.5 left-2 flex gap-1">
                      {isi.slice(0, 4).map(item => (
                        <span key={item.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || '#F59E0B' }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
            <a
              href={assetUrl('/api/cms/agendas/calendar.ics')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 transition-colors rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-amber-400 hover:text-amber-500"
            >
              <Download className="w-4 h-4" /> Unduh Kalender (.ics)
            </a>
            {hariTerpilih && (
              <button onClick={() => setHariTerpilih(null)} className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-amber-500">
                Bersihkan filter tanggal
              </button>
            )}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
        : agendaTampil.length === 0 ? (
          <div className="p-12 font-medium text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
            {hariTerpilih ? 'Tidak ada agenda pada tanggal terpilih.' : 'Belum ada agenda kegiatan dalam waktu dekat.'}
          </div>
        ) : <div className="space-y-6">
            {agendaTampil.map(item => (
              <div key={item.id} className="flex flex-col gap-6 p-6 transition-shadow bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:p-8 rounded-2xl md:flex-row hover:shadow-md">
                <div
                  className="flex flex-col items-center justify-center flex-shrink-0 w-32 h-32 text-amber-400 border border-amber-100 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60 rounded-xl"
                  style={{ borderTopColor: item.color || '#F59E0B', borderTopWidth: 4 }}
                >
                  <span className="text-4xl font-black">{new Date(item.date).getDate()}</span>
                  <span className="text-sm font-bold uppercase">{new Date(item.date).toLocaleString('id-ID', { month: 'short', year: 'numeric' })}</span>
                  {jumlahHariAgenda(item.date, item.endDate) > 1 && (
                    <span className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {jumlahHariAgenda(item.date, item.endDate)} hari
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{item.title}</h3>
                  <p className="mb-4 text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-4 mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-amber-500 dark:text-amber-400"/> {formatRentangTanggal(item.date, item.endDate)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-500 dark:text-blue-400"/> {item.time} WIB</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500 dark:text-red-400"/> {item.location}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Unduh berkas .ics single agen — bila fitur per-agenda ditambah, param item dipakai. */}
                    <a
                      href={assetUrl('/api/cms/agendas/calendar.ics')}
                      className="inline-flex items-center gap-2 px-4 py-2 font-bold text-amber-600 transition-colors border border-amber-200 rounded-lg dark:text-amber-400 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    >
                      <CalendarPlus className="w-4 h-4"/> Tambah ke Kalender
                    </a>
                    {/* Media sosial: terbuka untuk semua pengunjung, tanpa login. */}
                    {item.socialMediaLink && (
                      <a href={item.socialMediaLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 font-bold text-gray-600 transition-colors border border-gray-200 rounded-lg dark:text-gray-300 dark:border-gray-700 hover:border-amber-400 hover:text-amber-500">
                        <Share2 className="w-4 h-4" /> Media Sosial
                      </a>
                    )}
                    {/* Pendaftaran: hanya untuk akun minimal mahasiswa (sudah login). */}
                    {item.registrationLink && (
                      isMahasiswaOrAbove(user?.role) ? (
                        <a href={item.registrationLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 font-bold text-amber-500 transition-colors rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                          <LinkIcon className="w-4 h-4"/> Daftar Sekarang
                        </a>
                      ) : (
                        <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 font-bold text-gray-500 transition-colors border border-gray-200 rounded-lg dark:text-gray-400 dark:border-gray-700 hover:border-amber-400 hover:text-amber-500">
                          <Lock className="w-4 h-4" /> Masuk untuk mendaftar
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </main>
    </div>
  );
}
