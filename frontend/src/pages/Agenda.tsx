import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Clock, MapPin, Link as LinkIcon, Loader2, Code2, ArrowLeft } from 'lucide-react';

interface AgendaItem {
  id: string; title: string; description: string; date: string; time: string; location: string; registrationLink: string | null;
}

export default function Agenda() {
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cms/agendas')
      .then(res => setAgendas(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform bg-blue-600 rounded-lg shadow-lg group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-blue-600"><ArrowLeft className="w-4 h-4"/> Kembali</Link>
      </nav>

      <main className="max-w-5xl px-6 py-12 mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-black text-gray-900">Agenda & Kegiatan</h2>
          <p className="text-lg text-gray-500">Jadwal acara, seminar, dan kegiatan himpunan mahasiswa Teknik.</p>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>
        : agendas.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 bg-white border border-gray-200 shadow-sm rounded-2xl">Belum ada agenda kegiatan dalam waktu dekat.</div>
        : <div className="space-y-6">
            {agendas.map(item => (
              <div key={item.id} className="flex flex-col gap-6 p-6 transition-shadow bg-white border border-gray-100 shadow-sm md:p-8 rounded-2xl md:flex-row hover:shadow-md">
                <div className="flex flex-col items-center justify-center flex-shrink-0 w-32 h-32 text-blue-600 border border-blue-100 bg-blue-50 rounded-xl">
                  <span className="text-4xl font-black">{new Date(item.date).getDate()}</span>
                  <span className="text-sm font-bold uppercase">{new Date(item.date).toLocaleString('id-ID', { month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-2xl font-bold text-gray-900">{item.title}</h3>
                  <p className="mb-4 text-gray-600 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-4 mb-4 text-sm font-medium text-gray-500">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-500"/> {item.time} WIB</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500"/> {item.location}</span>
                  </div>
                  {item.registrationLink && (
                    <a href={item.registrationLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 font-bold text-blue-700 transition-colors rounded-lg bg-blue-50 hover:bg-blue-100">
                      <LinkIcon className="w-4 h-4"/> Daftar Sekarang
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>}
      </main>
    </div>
  );
}