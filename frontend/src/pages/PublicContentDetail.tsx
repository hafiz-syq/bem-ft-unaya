import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import { Loader2, Code2, ArrowLeft, Calendar, User } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

interface ContentDetail {
  id: string; type: string; title: string; content: string; image: string | null; createdAt: string;
  author: { profile: { nama: string } | null };
}

export default function PublicContentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cms/${id}`)
      .then(res => setContent(res.data.data))
      .catch(err => {
        console.error(err);
        alert('Konten tidak ditemukan atau telah dihapus.');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>;
  }

  if (!content) return null;

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50 dark:bg-gray-950">
      {/* Navbar Publik */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900 dark:text-gray-100">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4"/> Kembali</Link>
        <ThemeToggle />
      </nav>

      <main className="flex-1 w-full max-w-4xl px-6 py-10 mx-auto md:py-16">
        <article className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-3xl">
          {content.image && (
            <div className="flex items-center justify-center w-full h-64 p-4 bg-gray-900 md:h-96">
              <img 
                src={assetUrl(content.image)}
                alt={content.title} 
                className="object-contain max-w-full max-h-full rounded-lg shadow-2xl" 
              />
            </div>
          )}
          
          <div className="p-8 md:p-12">
            <span className={`px-3 py-1 text-xs font-bold rounded-full mb-6 inline-block ${content.type === 'BERITA' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-500' : content.type === 'PROGRAM' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'}`}>
              {content.type}
            </span>
            
            <h1 className="mb-6 text-3xl font-black leading-tight text-gray-900 dark:text-gray-100 md:text-5xl">{content.title}</h1>
            
            <div className="flex flex-wrap items-center gap-6 pb-8 mb-8 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400 dark:text-gray-500"/> Ditulis oleh <span className="font-bold text-gray-900 dark:text-gray-100">{content.author.profile?.nama}</span></div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {new Date(content.createdAt).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            
            {/* Menggunakan whitespace-pre-wrap agar enter/paragraf dari text-area tidak hilang */}
            <div className="text-lg leading-relaxed prose text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose-blue max-w-none">
              {content.content}
            </div>
          </div>
        </article>
      </main>
      
      <footer className="px-6 py-10 mt-auto text-sm text-center text-gray-400 dark:text-gray-500 bg-gray-900">
        <div className="flex flex-col items-center justify-between max-w-4xl gap-4 mx-auto md:flex-row">
          <div className="text-left"><h3 className="text-lg font-bold text-white">BEM FT UNAYA</h3></div>
          <div className="text-center md:text-right">
            <p>© 2026 Hak Cipta Dilindungi.</p>
            <p className="mt-1">Dibuat oleh <span className="font-bold text-amber-400">Hafiz Syauqi</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}