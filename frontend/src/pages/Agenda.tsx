import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Clock, MapPin, Link as LinkIcon, Loader2, Code2, ArrowLeft, Share2, Lock } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { isMahasiswaOrAbove } from '../lib/roles';

interface AgendaItem {
  id: string; title: string; description: string; date: string; time: string; location: string; registrationLink: string | null; socialMediaLink: string | null;
}

export default function Agenda() {
  const { user } = useAuth();
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cms/agendas')
      .then(res => setAgendas(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-black text-gray-900 dark:text-gray-100">Agenda & Kegiatan</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400">Jadwal acara, seminar, dan kegiatan himpunan mahasiswa Teknik.</p>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
        : agendas.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">Belum ada agenda kegiatan dalam waktu dekat.</div>
        : <div className="space-y-6">
            {agendas.map(item => (
              <div key={item.id} className="flex flex-col gap-6 p-6 transition-shadow bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:p-8 rounded-2xl md:flex-row hover:shadow-md">
                <div className="flex flex-col items-center justify-center flex-shrink-0 w-32 h-32 text-amber-400 border border-amber-100 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60 rounded-xl">
                  <span className="text-4xl font-black">{new Date(item.date).getDate()}</span>
                  <span className="text-sm font-bold uppercase">{new Date(item.date).toLocaleString('id-ID', { month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{item.title}</h3>
                  <p className="mb-4 text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-4 mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-500 dark:text-blue-400"/> {item.time} WIB</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500 dark:text-red-400"/> {item.location}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
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