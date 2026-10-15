import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { Send, LogIn, Code2, Users, Building, ShieldCheck, Loader2, Calendar, Newspaper, ArrowRight, MapPin, Clock, Image as ImageIcon, Landmark, X, ExternalLink, Menu, LayoutDashboard, MessageSquare } from 'lucide-react';
import axios from 'axios';

// --- KOMPONEN ANIMASI SCROLL ---
const RevealOnScroll = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
      {children}
    </div>
  );
};

// --- INTERFACES UNTUK MENGHINDARI ESLINT ANY ---
interface Content { id: string; type: string; title: string; content: string; createdAt: string; image: string | null; author: { profile: { nama: string } | null }; }
interface AgendaItem { id: string; title: string; description: string; date: string; time: string; location: string; registrationLink: string | null; }
interface GalleryItem { id: string; title: string; category: string; url: string; activity: string | null; year: number; }
interface PublicComment { id: string; nama: string; asal_kampus: string; content: string; createdAt: string; }

export default function Landing() {
  const { user } = useAuth(); // Ambil status login user saat ini
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State menu burger

  const mobileMenuAnchorRef = useRef<HTMLButtonElement>(null);

  const [formData, setFormData] = useState({ nama: '', asal_kampus: '', email: '', no_hp: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Data States
  const [publicContents, setPublicContents] = useState<Content[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  // Modal States
  const [selectedAgenda, setSelectedAgenda] = useState<AgendaItem | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);

  // --- FUNGSI HELPER SMOOTH SCROLL ---
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false); // Tutup menu mobile jika sedang terbuka
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${targetId}`);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [resContent, resAgenda, resGallery] = await Promise.all([
          api.get('/cms'), api.get('/cms/agendas'), api.get('/cms/galleries')
        ]);
        setPublicContents(resContent.data.data);
        setAgendas(resAgenda.data.data.slice(0, 3));
        setGalleries(resGallery.data.data.slice(0, 4));
      } catch (error) { 
        console.error('Gagal memuat data utama', error); 
      } 

      try {
        const resComments = await api.get('/public-comments');
        setComments(resComments.data.data.slice(0, 6));
      } catch (error) { 
        console.error('Gagal memuat komentar', error); 
      }
      setLoadingContent(false);
    };
    
    fetchAllData();
  }, []);

  useEffect(() => {
    if (selectedAgenda || selectedGallery) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectedAgenda, selectedGallery]);

  const programs = publicContents.filter(c => c.type === 'PROGRAM').slice(0, 3);
  const news = publicContents.filter(c => c.type === 'BERITA' || c.type === 'ARTIKEL').slice(0, 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setSuccessMsg(''); setErrorMsg('');
    try {
      const res = await api.post('/public-comments', formData);
      setSuccessMsg(res.data.message);
      setFormData({ nama: '', asal_kampus: '', email: '', no_hp: '', content: '' });
      const resComments = await api.get('/public-comments');
      setComments(resComments.data.data.slice(0, 6));
    } catch (error) {
      if (axios.isAxiosError(error)) setErrorMsg(error.response?.data?.message || 'Gagal mengirim pesan.');
      else setErrorMsg('Terjadi kesalahan.');
    } finally { setIsSubmitting(false); }
  };

  return (
    // Penambahan overflow-x-hidden dan w-full untuk mencegah layar scroll ke samping
    <div className="relative flex flex-col min-h-screen font-sans bg-gray-50 selection:bg-amber-50">

      {/* --- OVERLAY MASK --- */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />

      {/* --- NAVBAR LENGKAP --- */}        
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-white border-b border-gray-200 shadow-sm sm:px-6 backdrop-blur-md bg-white/90" style={{ paddingBottom: '0px' }} aria-label="Navigasi utama">
        <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="flex items-center justify-center w-10 h-10 transition-transform duration-300 rounded-lg shadow-lg bg-amber-400 group-hover:rotate-12 group-active:scale-90">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900">BEM FT UNAYA</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Portal Resmi</p>
          </div>
        </div>

        {/* Menu Desktop */}
        <div className="items-center hidden gap-8 text-sm font-bold text-gray-600 lg:flex">
          <a href="#sejarah" onClick={(e) => handleSmoothScroll(e, 'sejarah')} className="transition-colors hover:text-amber-500">Sejarah</a>
          <a href="#program" onClick={(e) => handleSmoothScroll(e, 'program')} className="transition-colors hover:text-amber-500">Program</a>
          <a href="#berita" onClick={(e) => handleSmoothScroll(e, 'berita')} className="transition-colors hover:text-amber-500">Berita</a>
          <a href="#agenda" onClick={(e) => handleSmoothScroll(e, 'agenda')} className="transition-colors hover:text-amber-500">Agenda</a>
          <a href="#galeri" onClick={(e) => handleSmoothScroll(e, 'galeri')} className="transition-colors hover:text-amber-500">Galeri</a>
        </div>

        {/* Tombol Aksi Desktop */}
        <div className="items-center hidden lg:flex shrink-0">
          {user ? (
            <Link to="/dashboard" className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-white font-bold rounded-lg hover:bg-amber-500 hover:-translate-y-0.5 active:scale-95 transition-all">
              <LayoutDashboard className="w-4 h-4" /> Ke Dashboard
            </Link>
          ) : (
            <Link to="/login" className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-white font-bold rounded-lg hover:bg-amber-500 hover:-translate-y-0.5 active:scale-95 transition-all">
              <LogIn className="w-4 h-4" /> Masuk Portal
            </Link>
          )}
        </div>

        {/* Tombol Burger Mobile */}
        <button
          ref={mobileMenuAnchorRef}
          className="relative z-50 p-2 text-gray-600 rounded lg:hidden hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 shrink-0"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Menu Mobile Dropdown */}
        <div 
          className={`absolute left-0 right-0 top-[100%] z-50 flex flex-col w-full px-4 py-2 lg:hidden transition-all duration-[700ms] ${isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          <div
            className="w-full max-w-sm mx-auto overflow-hidden bg-white shadow-2xl rounded-2xl"
            style={{
              transition: 'all 700ms cubic-bezier(0.16, 1, 0.3, 1)', 
              transform: isMobileMenuOpen ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
              opacity: isMobileMenuOpen ? 1 : 0,
            }}
          >
            <div className="flex flex-col gap-1 p-5">
              <a href="#sejarah" onClick={(e) => { handleSmoothScroll(e, 'sejarah'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors rounded-xl hover:bg-amber-50 hover:text-amber-600">
                <Landmark className="w-5 h-5" /> Sejarah
              </a>
              <a href="#program" onClick={(e) => { handleSmoothScroll(e, 'program'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors rounded-xl hover:bg-amber-50 hover:text-amber-600">
                <Code2 className="w-5 h-5" /> Program Kerja
              </a>
              <a href="#berita" onClick={(e) => { handleSmoothScroll(e, 'berita'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors rounded-xl hover:bg-amber-50 hover:text-amber-600">
                <Newspaper className="w-5 h-5" /> Berita Terbaru
              </a>
              <a href="#agenda" onClick={(e) => { handleSmoothScroll(e, 'agenda'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors rounded-xl hover:bg-amber-50 hover:text-amber-600">
                <Clock className="w-5 h-5" /> Agenda Kegiatan
              </a>
              <a href="#galeri" onClick={(e) => { handleSmoothScroll(e, 'galeri'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors rounded-xl hover:bg-amber-50 hover:text-amber-600">
                <ImageIcon className="w-5 h-5" /> Galeri Media
              </a>
              <div className="my-3 border-t border-gray-100" />
              {user ? (
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-2 py-3 font-bold text-white transition-all shadow-md bg-amber-400 rounded-xl hover:bg-amber-500 active:scale-95">
                  <LayoutDashboard className="w-5 h-5"/> Ke Dashboard
                </Link>
              ) : (
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-2 py-3 font-bold text-white transition-all shadow-md rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-95">
                  <LogIn className="w-5 h-5"/> Masuk Portal
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="px-4 py-20 overflow-hidden text-white sm:px-6 sm:py-24 bg-gradient-to-br from-neutral-700 via-neutral-800 to-zinc-900">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <RevealOnScroll delay={100}>
            {/* Responsif untuk teks hero */}
            <h2 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Kolaborasi Nyata Untuk <span className="text-red-700">TEKNIK</span> <span className='text-amber-400'>Yang Lebih Baik</span>
            </h2>
          </RevealOnScroll>
          <RevealOnScroll delay={300}>
            <p className="max-w-2xl mx-auto text-base text-white sm:text-lg md:text-xl opacity-90">
              Selamat datang di Portal Resmi Badan Eksekutif Mahasiswa Fakultas Teknik Universitas Abulyatama. Kami hadir sebagai wadah aspirasi dan inovasi mahasiswa.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={500}>
            {/* Penambahan flex-col sm:flex-row agar tombol menyusun rapi di bawah pada layar kecil */}
            <div className="flex flex-col justify-center gap-4 pt-6 sm:flex-row">
              <a href="#berita" onClick={(e) => handleSmoothScroll(e, 'berita')} className="w-full px-6 py-3 font-bold transition-all duration-300 bg-white rounded-lg shadow-lg sm:w-auto text-amber-400 hover:bg-gray-100 hover:scale-105 active:scale-95">Kabar Terbaru</a>
              <a href="#program" onClick={(e) => handleSmoothScroll(e, 'program')} className="w-full px-6 py-3 font-bold text-white transition-all duration-300 border rounded-lg sm:w-auto border-amber-300 bg-amber-400 hover:bg-amber-300 hover:scale-105 active:scale-95">Program Kerja</a>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* FITUR UTAMA */}
      <section className="relative z-10 max-w-6xl px-4 py-16 mx-auto -mt-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 sm:gap-8">
          <RevealOnScroll delay={200}>
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-blue-600 transition-transform duration-300 rounded-full w-14 h-14 bg-blue-50 group-hover:scale-110"><Users className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Aspirasi Terpusat</h3>
              <p className="text-sm text-gray-500">Sampaikan keluhan langsung melalui sistem tiket yang transparan.</p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={400}>
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-green-600 transition-transform duration-300 rounded-full w-14 h-14 bg-green-50 group-hover:scale-110"><ShieldCheck className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Validasi Terjamin</h3>
              <p className="text-sm text-gray-500">Data mahasiswa yang tersinkronisasi dan aman secara sistematis.</p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={600}>
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-purple-600 transition-transform duration-300 rounded-full w-14 h-14 bg-purple-50 group-hover:scale-110"><Building className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Struktur Dinamis</h3>
              <p className="text-sm text-gray-500">Kenali siapa saja yang bekerja di balik layar BEM FT UNAYA.</p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* --- SEJARAH TEKNIK --- */}
      <section id="sejarah" className="px-4 py-16 bg-white border-t border-gray-200 sm:px-6 sm:py-20">
        <RevealOnScroll>
          <div className="flex flex-col items-center max-w-6xl gap-10 mx-auto md:flex-row">
            <div className="space-y-6 md:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-amber-100 text-amber-700">
                <Landmark className="w-4 h-4 shrink-0" /> Profil Fakultas
              </div>
              <h2 className="text-3xl font-black leading-tight text-gray-900 sm:text-4xl">Sejarah Singkat <br />Fakultas Teknik UNAYA</h2>
              <p className="text-base leading-relaxed text-gray-600 sm:text-lg">
                Fakultas Teknik Universitas Abulyatama didirikan dengan tujuan mulia untuk mencetak insinyur dan tenaga ahli keteknikan yang unggul, berintegritas, dan siap berkontribusi dalam pembangunan bangsa.
              </p>
              <p className="text-sm text-gray-500 sm:text-base">
                Seiring berjalannya waktu, BEM-FT hadir sebagai wadah perjuangan, inovasi, dan kreativitas mahasiswa teknik untuk menyalurkan gagasan dan menjaga tradisi solidaritas.
              </p>
              <Link to="/about" className="inline-flex items-center gap-2 pt-2 font-bold transition-all text-amber-500 hover:text-amber-600 hover:gap-3">
                Lihat Struktur Kepengurusan <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative w-full overflow-hidden bg-gray-100 border border-gray-200 shadow-lg h-72 sm:h-80 rounded-3xl">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Kampus Teknik" className="object-cover w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/40 to-transparent"></div>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* --- KONTEN DINAMIS UTAMA (PROGRAM & BERITA) --- */}
      <section className="px-4 py-16 border-t border-gray-200 sm:px-6 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto space-y-20 sm:space-y-24">

          {/* PROGRAM KERJA */}
          <RevealOnScroll>
            <div id="program">
              <div className="flex items-end justify-between mb-8">
                <h2 className="flex items-center gap-2 text-2xl font-black text-gray-900 sm:text-3xl"><Calendar className="text-amber-400 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Program Unggulan</h2>
              </div>
              {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
                : programs.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl">Belum ada program kerja.</div>
                  : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {programs.map((prog, index) => (
                      <RevealOnScroll key={prog.id} delay={index * 200}>
                        <Link to={`/post/${prog.id}`} className="flex flex-col h-full overflow-hidden transition-all duration-300 bg-white border border-gray-200 shadow-sm cursor-pointer rounded-2xl hover:shadow-xl hover:-translate-y-1.5 active:scale-[0.98]">
                          {prog.image && (
                            <div className="w-full h-48 bg-gray-100 border-b border-gray-100">
                              <img src={`http://localhost:3000${prog.image}`} alt={prog.title} className="object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex flex-col flex-grow p-6">
                            <span className="px-3 py-1 mb-4 text-xs font-bold text-purple-700 bg-purple-100 rounded-full w-max">PROGRAM KERJA</span>
                            <h3 className="mb-3 text-xl font-bold text-gray-900">{prog.title}</h3>
                            <p className="text-sm text-gray-600 line-clamp-4">{prog.content}</p>
                          </div>
                        </Link>
                      </RevealOnScroll>
                    ))}
                  </div>}
            </div>
          </RevealOnScroll>

          {/* BERITA */}
          <RevealOnScroll>
            <div id="berita">
              <h2 className="flex items-center gap-2 mb-8 text-2xl font-black text-gray-900 sm:text-3xl"><Newspaper className="text-amber-400 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Kabar Terbaru</h2>
              {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
                : news.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl">Belum ada berita.</div>
                  : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {news.map((item, index) => (
                      <RevealOnScroll key={item.id} delay={index * 200}>
                        <Link to={`/post/${item.id}`} className="flex flex-col justify-between h-full overflow-hidden transition-all duration-300 bg-white border border-gray-200 shadow-sm cursor-pointer rounded-2xl group hover:shadow-xl hover:-translate-y-1.5 active:scale-[0.98]">
                          {item.image && (
                            <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                              <img src={`http://localhost:3000${item.image}`} alt={item.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 transition-opacity opacity-0 bg-gradient-to-t from-black/50 to-transparent group-hover:opacity-100"></div>
                            </div>
                          )}
                          <div className="flex flex-col flex-grow p-6">
                            <span className="px-3 py-1 mb-4 text-xs font-bold rounded-full text-amber-500 bg-amber-100 w-max">{item.type}</span>
                            <h3 className="mb-3 text-xl font-bold text-gray-900 transition-colors group-hover:text-amber-400">{item.title}</h3>
                            <p className="mb-4 text-sm text-gray-600 line-clamp-3">{item.content}</p>
                            <div className="flex items-center justify-between pt-4 mt-auto border-t border-gray-100">
                              <div className="text-xs font-medium text-gray-500"><p className="font-bold text-gray-900">{item.author.profile?.nama}</p><p>{new Date(item.createdAt).toLocaleDateString('id-ID')}</p></div>
                              <button className="flex items-center justify-center w-8 h-8 transition-all duration-300 rounded-full text-amber-400 bg-gray-50 shrink-0 group-hover:bg-amber-400 group-hover:text-white"><ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></button>
                            </div>
                          </div>
                        </Link>
                      </RevealOnScroll>
                    ))}
                  </div>}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* --- AGENDA KEGIATAN --- */}
      <section id="agenda" className="px-4 py-16 bg-white border-t border-gray-200 sm:px-6 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll>
            <div className="flex items-end justify-between mb-8 sm:mb-10">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-gray-900 sm:text-3xl"><Clock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" /> Agenda Kegiatan</h2>
                <p className="mt-2 text-sm text-gray-500 sm:text-base">Jadwal acara dan kegiatan terdekat fakultas.</p>
              </div>
              <Link to="/agenda" className="items-center hidden gap-2 font-bold transition-colors md:flex text-amber-500 hover:text-amber-600">Lihat Semua <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </RevealOnScroll>

          {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
            : agendas.length === 0 ? <div className="p-10 text-center text-gray-500 border border-gray-200 bg-gray-50 rounded-2xl">Belum ada agenda terdekat.</div>
              : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {agendas.map((item, index) => (
                  <RevealOnScroll key={item.id} delay={index * 200}>
                    <div onClick={() => setSelectedAgenda(item)} className="flex flex-col h-full p-6 transition-all border border-gray-100 cursor-pointer bg-gray-50 rounded-2xl hover:shadow-lg hover:-translate-y-1 group">
                      <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-200">
                        {/* Menambahkan shrink-0 agar kotak tanggal tidak menyusut */}
                        <div className="flex items-center justify-center text-2xl font-black transition-colors shrink-0 bg-amber-100 text-amber-700 w-14 h-14 rounded-xl group-hover:bg-amber-500 group-hover:text-white">
                          {new Date(item.date).getDate()}
                        </div>
                        <div>
                          <div className="text-xs font-bold tracking-wider text-gray-500 uppercase">{new Date(item.date).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</div>
                          <div className="flex items-center gap-1 text-sm font-bold text-gray-900"><Clock className="w-3 h-3 shrink-0" /> {item.time} WIB</div>
                        </div>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-amber-600">{item.title}</h3>
                      <p className="flex-grow mb-4 text-sm text-gray-600 line-clamp-2">{item.description}</p>
                      <div className="flex items-start gap-1 mt-auto text-xs font-bold text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> <span className="line-clamp-1">{item.location}</span>
                      </div>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>}
          <div className="mt-6 text-center md:hidden">
            <Link to="/agenda" className="inline-flex items-center gap-2 font-bold text-amber-500 hover:text-amber-600">Lihat Semua Agenda <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      {/* --- GALERI MEDIA --- */}
      <section id="galeri" className="px-4 py-16 bg-gray-900 border-t border-gray-800 sm:px-6 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll>
            <div className="flex items-end justify-between mb-8 sm:mb-10">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl"><ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 shrink-0" /> Galeri Media</h2>
                <p className="mt-2 text-sm text-gray-400 sm:text-base">Dokumentasi momen penting mahasiswa Teknik.</p>
              </div>
              <Link to="/gallery" className="items-center hidden gap-2 font-bold transition-colors md:flex text-amber-400 hover:text-amber-300">Lihat Semua <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </RevealOnScroll>

          {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
            : galleries.length === 0 ? <div className="p-10 text-center text-gray-500 border border-gray-800 rounded-2xl">Belum ada foto.</div>
              : <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {galleries.map((item, index) => (
                  <RevealOnScroll key={item.id} delay={index * 150}>
                    <div onClick={() => setSelectedGallery(item)} className="relative overflow-hidden bg-gray-800 border border-gray-700 shadow-lg cursor-pointer group rounded-2xl aspect-square hover:shadow-amber-500/20">
                      <img src={`http://localhost:3000${item.url}`} alt={item.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 flex flex-col justify-end p-3 transition-opacity opacity-0 sm:p-4 bg-gradient-to-t from-black/90 via-black/30 to-transparent group-hover:opacity-100">
                        <h4 className="text-xs font-bold text-white sm:text-sm line-clamp-2">{item.title}</h4>
                        <span className="text-amber-400 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><ImageIcon className="w-3 h-3 shrink-0" /> {item.category}</span>
                      </div>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>}
          <div className="mt-8 text-center md:hidden">
            <Link to="/gallery" className="inline-flex items-center gap-2 font-bold text-amber-400 hover:text-amber-300">Lihat Semua Galeri <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      {/* --- BUKU TAMU & MENAMPILKAN KOMENTAR PUBLIK --- */}
      <section className="px-4 py-16 bg-white border-t border-gray-200 sm:px-6 sm:py-24">
        <RevealOnScroll>
          <div className="max-w-6xl mx-auto">
            
            <div className="max-w-2xl mx-auto mb-12 text-center sm:mb-16">
              <h2 className="flex items-center justify-center gap-2 text-2xl font-black text-gray-900 sm:text-3xl"><MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0"/> Suara Publik</h2>
              <p className="mt-2 text-sm text-gray-500 sm:text-base">Tinggalkan pesan, dukungan, kritik, atau penawaran kerja sama kepada BEM FT UNAYA.</p>
            </div>

            <div className="grid items-start grid-cols-1 gap-12 lg:grid-cols-2">
              
              {/* KOLOM KIRI: DAFTAR KOMENTAR */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pb-4">
                {comments.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 border border-gray-200 bg-gray-50 rounded-2xl">Belum ada pesan publik. Jadilah yang pertama!</div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="p-5 border border-gray-100 shadow-sm sm:p-6 bg-gray-50 rounded-2xl">
                      <p className="mb-4 italic leading-relaxed text-gray-700">"{comment.content}"</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-center w-10 h-10 text-lg font-black rounded-full shrink-0 bg-amber-100 text-amber-700">{comment.nama.charAt(0)}</div>
                        <div className="overflow-hidden">
                          <h4 className="text-sm font-bold text-gray-900 truncate">{comment.nama}</h4>
                          <p className="text-xs text-gray-500 truncate">{comment.asal_kampus} • {new Date(comment.createdAt).toLocaleDateString('id-ID')}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* KOLOM KANAN: FORM KIRIM PESAN */}
              <form onSubmit={handleSubmit} className="sticky p-6 space-y-5 bg-white border border-gray-100 shadow-xl sm:p-8 rounded-3xl top-24">
                <h3 className="pb-2 text-xl font-bold border-b">Kirim Pesan</h3>
                {successMsg && <div className="flex items-center gap-2 p-4 text-sm font-bold text-green-800 bg-green-100 border rounded-lg"><ShieldCheck className="w-4 h-4 shrink-0"/> {successMsg}</div>}
                {errorMsg && <div className="p-4 text-sm font-bold text-red-800 bg-red-100 border rounded-lg">{errorMsg}</div>}
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <input required type="text" placeholder="Nama Lengkap" className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-amber-500" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                  <input required type="text" placeholder="Asal Instansi/Kampus" className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-amber-500" value={formData.asal_kampus} onChange={e => setFormData({...formData, asal_kampus: e.target.value})} />
                  <input required type="email" placeholder="Alamat Email" className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-amber-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input required type="text" placeholder="No. HP / WhatsApp" className="w-full p-3 border border-gray-300 rounded-lg outline-none bg-gray-50 focus:ring-2 focus:ring-amber-500" value={formData.no_hp} onChange={e => setFormData({...formData, no_hp: e.target.value})} />
                </div>
                <textarea required rows={4} placeholder="Tuliskan pesan Anda di sini..." className="w-full p-3 border border-gray-300 rounded-lg outline-none resize-none bg-gray-50 focus:ring-2 focus:ring-amber-500" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
                
                <button type="submit" disabled={isSubmitting} className="flex items-center justify-center w-full gap-2 py-3 font-bold text-white transition-all duration-200 rounded-lg bg-amber-400 hover:bg-amber-500 hover:shadow-lg active:scale-95">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Send className="w-5 h-5 shrink-0" /> Kirim Pesan Publik</>}
                </button>
              </form>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* --- FOOTER --- */}
      <footer className="px-4 py-8 mt-auto text-sm text-center text-gray-400 bg-gray-900 border-t border-gray-800 sm:px-6 sm:py-10">
        <RevealOnScroll>
          <div className="flex flex-col items-center justify-between max-w-6xl gap-4 mx-auto md:flex-row">
            <div className="text-center md:text-left"><h3 className="text-lg font-bold text-white">BEM FT UNAYA</h3></div>
            <div className="text-center md:text-right"><p>© 2026 Hak Cipta Dilindungi.</p></div>
          </div>
        </RevealOnScroll>
      </footer>

      {/* --- MODAL AGENDA --- */}
      {selectedAgenda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedAgenda(null)}>
          <div className="relative w-full max-w-lg overflow-hidden duration-200 bg-white shadow-2xl rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedAgenda(null)} className="absolute z-10 p-2 text-gray-500 transition-colors bg-gray-100 rounded-full top-4 right-4 hover:bg-red-100 hover:text-red-600"><X className="w-5 h-5" /></button>

            <div className="p-6 pt-10 text-center sm:p-8 bg-amber-400">
              <div className="flex flex-col items-center justify-center w-20 h-20 mx-auto mb-4 text-3xl font-black bg-white shadow-lg sm:w-24 sm:h-24 sm:text-4xl text-amber-600 rounded-2xl">
                <span className="text-2xl sm:text-3xl">{new Date(selectedAgenda.date).getDate()}</span>
                <span className="text-[10px] sm:text-xs font-bold uppercase">{new Date(selectedAgenda.date).toLocaleString('id-ID', { month: 'short' })}</span>
              </div>
              <h2 className="text-xl font-black text-white sm:text-2xl">{selectedAgenda.title}</h2>
            </div>

            <div className="p-6 space-y-6 sm:p-8">
              <div className="flex flex-col gap-3 p-4 text-xs font-medium text-gray-700 border border-gray-100 sm:text-sm bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-gray-400 shrink-0" /> {new Date(selectedAgenda.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div className="flex items-center gap-3"><Clock className="w-5 h-5 text-gray-400 shrink-0" /> Pukul {selectedAgenda.time} WIB - Selesai</div>
                <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-gray-400 shrink-0" /> <span>{selectedAgenda.location}</span></div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold tracking-wider text-gray-500 uppercase">Deskripsi Kegiatan</h4>
                <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">{selectedAgenda.description}</p>
              </div>

              {selectedAgenda.registrationLink && (
                <a href={selectedAgenda.registrationLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full gap-2 py-3 mt-4 font-bold text-white transition-all shadow-md bg-amber-400 rounded-xl hover:bg-amber-500 active:scale-95">
                  Daftar / Ikuti Kegiatan <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL GALERI --- */}
      {selectedGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-gray-900/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedGallery(null)}>
          <button onClick={() => setSelectedGallery(null)} className="absolute z-10 p-2 text-white transition-colors rounded-full top-4 right-4 sm:top-6 sm:right-6 bg-white/10 hover:bg-red-500 backdrop-blur-sm"><X className="w-6 h-6" /></button>

          <div className="flex flex-col w-full max-w-5xl overflow-hidden duration-200 bg-black shadow-2xl rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="relative w-full h-[50vh] sm:h-[75vh] bg-black flex items-center justify-center">
              <img src={`http://localhost:3000${selectedGallery.url}`} alt={selectedGallery.title} className="object-contain max-w-full max-h-full" />
            </div>

            <div className="flex flex-col items-start justify-between gap-4 p-5 bg-gray-900 border-t border-gray-800 sm:p-6 sm:flex-row sm:items-center">
              <div className="w-full">
                <h3 className="text-base font-bold text-white sm:text-lg lg:text-xl line-clamp-2">{selectedGallery.title}</h3>
                <p className="mt-1 text-xs text-gray-400 sm:text-sm">{selectedGallery.activity || 'Dokumentasi Umum'} • {selectedGallery.year}</p>
              </div>
              <span className="px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider uppercase border rounded-full shrink-0 bg-amber-400/10 text-amber-400 border-amber-400/20 whitespace-nowrap">
                {selectedGallery.category}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}