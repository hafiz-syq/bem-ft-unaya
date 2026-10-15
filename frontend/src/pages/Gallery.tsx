import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { Loader2, Code2, ArrowLeft } from 'lucide-react';

interface GalleryItem {
  id: string; title: string; category: string; url: string; activity: string | null; year: number;
}

export default function Gallery() {
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cms/galleries')
      .then(res => setGalleries(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4"/> Kembali</Link>
      </nav>

      <main className="max-w-6xl px-6 py-12 mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-black text-gray-900">Galeri Dokumentasi</h2>
          <p className="text-lg text-gray-500">Momen penting dan rekam jejak kegiatan mahasiswa Teknik.</p>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
        : galleries.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 bg-white border border-gray-200 shadow-sm rounded-2xl">Belum ada dokumentasi publik.</div>
        : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {galleries.map(item => (
              <div key={item.id} className="overflow-hidden transition-all bg-white border border-gray-100 shadow-sm rounded-2xl group hover:shadow-xl hover:-translate-y-1">
                <div className="relative h-56 overflow-hidden bg-gray-200">
                  <img src={`http://localhost:3000${item.url}`} alt={item.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">{item.category}</div>
                </div>
                <div className="p-4">
                  <h3 className="mb-1 font-bold text-gray-900 truncate">{item.title}</h3>
                  <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                    <span className="truncate max-w-[120px]">{item.activity || 'Umum'}</span>
                    <span>{item.year}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </main>
    </div>
  );
}