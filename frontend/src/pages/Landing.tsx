import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { useSeasonalTheme } from '../contexts/SeasonalThemeContext';
import { LABEL_TEMA, UCAPAN_TEMA } from '../lib/tema-musiman';
import { isMahasiswaOrAbove, targetLabel } from '../lib/roles';
import ThemeToggle from '../components/ThemeToggle';
import GalleryComments from '../components/GalleryComments';
import UserAvatar from '../components/UserAvatar';
import LazyImage from '../components/LazyImage';
import { formatRentangTanggal, jumlahHariAgenda } from '../lib/tanggal';
import { Send, LogIn, Code2, Users, Building, ShieldCheck, Loader2, Calendar, Newspaper, ArrowRight, MapPin, Clock, Image as ImageIcon, Landmark, X, ExternalLink, Menu, LayoutDashboard, MessageSquare, Award, ChevronLeft, ChevronRight, Megaphone, AlertCircle, Layers, CornerDownRight, Share2, Lock, MoonStar, PartyPopper, Flag } from 'lucide-react';
import axios from 'axios';

// Data statis hasil prerender dibaca sekali di sini; deklarasi tipe supaya
// aksesnya diperiksa TypeScript, bukan lewat `any`.
declare global {
  interface Window {
    __LANDING_DATA__?: {
      version: number;
      nav: unknown;
      hero: unknown;
      fitur: unknown;
      sejarah: unknown;
    };
  }
}

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
interface AgendaItem { id: string; title: string; description: string; date: string; endDate: string | null; color: string | null; time: string; location: string; registrationLink: string | null; socialMediaLink: string | null; }
interface GalleryItem { id: string; title: string; category: string; url: string; activity: string | null; year: number; images?: { id: string; url: string; order: number }[]; }
interface BalasanPublik { id: string; content: string; penulis: string; role: string; createdAt: string; }
// Hanya komentar yang sudah disetujui yang dikirim server ke halaman ini, dan
// tanpa data kontak pengirim — lihat public-comment.controller.ts.
interface PublicComment { id: string; nama: string; asal_kampus: string; content: string; createdAt: string; balasan: BalasanPublik[]; }

/**
 * Tiket yang sudah tayang di halaman publik.
 * Aspirasi membawa identitas pengirim; keluhan selalu anonim (pengirim = null).
 */
interface PublicTicket {
  id: string;
  ticket_no: string | null;
  type: string;
  category: string;
  title: string;
  content: string;
  targetOrganization: string | null;
  targetLabel: string | null;
  status: string;
  createdAt: string;
  pengirim: { id: string; nama: string | null; nim: string; foto?: string | null } | null;
  anonim: boolean;
  balasan: { id: string; content: string; createdAt: string }[];
}

interface DemisionerItem {
  id: string; organization: string; nama: string; nim: string; jabatan: string | null;
  periode: string; foto: string | null; description: string | null;
}

export default function Landing() {
  const { user } = useAuth(); // Ambil status login user saat ini
  const { tema: temaMusiman } = useSeasonalTheme();
  const ucapanMusiman = UCAPAN_TEMA[temaMusiman];
  const IkonMusiman = temaMusiman === 'RAMADAN' ? MoonStar : temaMusiman === 'LEBARAN' ? PartyPopper : Flag;
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
  const [publicTickets, setPublicTickets] = useState<PublicTicket[]>([]);
  const [demisioner, setDemisioner] = useState<DemisionerItem[]>([]);
  const [demoIndex, setDemoIndex] = useState(0);
  const [loadingContent, setLoadingContent] = useState(true);

  // Prerender data (jika ada dari build)
  const prerenderData = (typeof window !== 'undefined' && window.__LANDING_DATA__) || null;
  const isUsingPrerender = !!prerenderData;

  // Modal States
  const [selectedAgenda, setSelectedAgenda] = useState<AgendaItem | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);

  // Tutup modal agenda/galeri dengan tombol Escape (atasan keyboard).
  useEffect(() => {
    if (!selectedAgenda && !selectedGallery) return;
    const padaEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAgenda(null);
        setSelectedGallery(null);
      }
    };
    window.addEventListener('keydown', padaEscape);
    return () => window.removeEventListener('keydown', padaEscape);
  }, [selectedAgenda, selectedGallery]);
  const [gallerySlide, setGallerySlide] = useState(0);
  const [filterTiket, setFilterTiket] = useState<'ALL' | 'ASPIRASI' | 'KELUHAN'>('ALL');

  // --- FUNGSI HELPER SMOOTH SCROLL ---
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false); // Tutup menu mobile jika sedang terbuka
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${targetId}`);
    }
  };  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Jika ada data prerender, gunakan sebagai data awal
        if (prerenderData && isUsingPrerender) {
          console.log('[Landing] Menggunakan data prerender dari build');
          // Data prerender hanya untuk navigasi & hero, tidak untuk content dinamis
          // Content dinamis tetap di-fetch dari API
        }

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

      // Aspirasi & keluhan yang sudah tayang (keluhan sudah dianonimkan server).
      try {
        const resTickets = await api.get('/tickets/public', { params: { limit: 6 } });
        setPublicTickets(resTickets.data.data);
      } catch (error) {
        console.error('Gagal memuat aspirasi publik', error);
      } 

      // Pratinjau riwayat demisioner untuk bagian sejarah.
      try {
        const resDemisioner = await api.get('/demisioner');
        setDemisioner(resDemisioner.data.data.slice(0, 5));
      } catch (error) {
        console.error('Gagal memuat demisioner', error);
      } 

      setLoadingContent(false);
    };
    
    fetchAllData();
  }, [prerenderData, isUsingPrerender]);

  useEffect(() => {
    if (selectedAgenda || selectedGallery) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectedAgenda, selectedGallery]);

  const programs = publicContents.filter(c => c.type === 'PROGRAM').slice(0, 3);
  const news = publicContents.filter(c => c.type === 'BERITA' || c.type === 'ARTIKEL').slice(0, 3);

  // Riwayat demisioner pada bagian sejarah.
  const aktifDemo = demisioner[demoIndex] ?? demisioner[0] ?? null;
  const geserDemo = (arah: number) => {
    if (demisioner.length === 0) return;
    setDemoIndex((prev) => (prev + arah + demisioner.length) % demisioner.length);
  };

  // Daftar foto sebuah postingan galeri (relasi images, fallback ke cover lama).
  const fotoGaleri = (item: GalleryItem): string[] =>
    item.images && item.images.length > 0 ? item.images.map((img) => img.url) : [item.url];

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
    <div className="relative flex flex-col min-h-screen font-sans bg-gray-50 dark:bg-gray-950 selection:bg-amber-50 dark:selection:bg-amber-950/60">
      {/* Tautan lompat: agar pengguna keyboard langsung ke konten utama */}
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:font-bold focus:text-white focus:bg-amber-500 focus:rounded-lg"
      >
        Lewati ke konten utama
      </a>

      {/* --- OVERLAY MASK --- */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />

      {/* --- NAVBAR LENGKAP --- */}        
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-900/90 dark:border-gray-800 sm:px-6 backdrop-blur-md bg-white/90" style={{ paddingBottom: '0px' }} aria-label="Navigasi utama">
        <div
          role="button"
          tabIndex={0}
          aria-label="TEKNIK UNAYA — Portal Resmi, kembali ke atas"
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
        >
          <div className="flex items-center justify-center w-10 h-10 transition-transform duration-300 rounded-lg shadow-lg bg-amber-400 group-hover:rotate-12 group-active:scale-90">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">TEKNIK UNAYA</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Portal Resmi</p>
          </div>
        </div>

        {/* Menu Desktop */}
        <div className="items-center hidden gap-8 text-sm font-bold text-gray-600 dark:text-gray-400 lg:flex">
          <a href="#sejarah" onClick={(e) => handleSmoothScroll(e, 'sejarah')} className="transition-colors hover:text-amber-500">Sejarah</a>
          <a href="#program" onClick={(e) => handleSmoothScroll(e, 'program')} className="transition-colors hover:text-amber-500">Program</a>
          <a href="#berita" onClick={(e) => handleSmoothScroll(e, 'berita')} className="transition-colors hover:text-amber-500">Berita</a>
          <a href="#agenda" onClick={(e) => handleSmoothScroll(e, 'agenda')} className="transition-colors hover:text-amber-500">Agenda</a>
          <a href="#galeri" onClick={(e) => handleSmoothScroll(e, 'galeri')} className="transition-colors hover:text-amber-500">Galeri</a>
          <a href="#aspirasi" onClick={(e) => handleSmoothScroll(e, 'aspirasi')} className="transition-colors hover:text-amber-500">Aspirasi</a>
        </div>

        {/* Tombol Tema + Aksi Desktop. Tema sengaja di luar blok `hidden lg:flex`
            supaya pengunjung ponsel tetap bisa mengganti tema. */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <div className="items-center hidden lg:flex">
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
        </div>

        {/* Tombol Burger Mobile */}
        <button
          ref={mobileMenuAnchorRef}
          className="relative z-50 p-2 text-gray-600 rounded dark:text-gray-400 lg:hidden hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 shrink-0"
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
            className="w-full max-w-sm mx-auto overflow-hidden bg-white shadow-2xl dark:bg-gray-900 rounded-2xl"
            style={{
              transition: 'all 700ms cubic-bezier(0.16, 1, 0.3, 1)', 
              transform: isMobileMenuOpen ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
              opacity: isMobileMenuOpen ? 1 : 0,
            }}
          >
            <div className="flex flex-col gap-1 p-5">
              <a href="#sejarah" onClick={(e) => { handleSmoothScroll(e, 'sejarah'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <Landmark className="w-5 h-5" /> Sejarah
              </a>
              <a href="#program" onClick={(e) => { handleSmoothScroll(e, 'program'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <Code2 className="w-5 h-5" /> Program Kerja
              </a>
              <a href="#berita" onClick={(e) => { handleSmoothScroll(e, 'berita'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <Newspaper className="w-5 h-5" /> Berita Terbaru
              </a>
              <a href="#agenda" onClick={(e) => { handleSmoothScroll(e, 'agenda'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <Clock className="w-5 h-5" /> Agenda Kegiatan
              </a>
              <a href="#galeri" onClick={(e) => { handleSmoothScroll(e, 'galeri'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <ImageIcon className="w-5 h-5" /> Galeri Media
              </a>
              <a href="#aspirasi" onClick={(e) => { handleSmoothScroll(e, 'aspirasi'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 transition-colors dark:text-gray-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 dark:hover:text-amber-300">
                <Megaphone className="w-5 h-5" /> Aspirasi &amp; Keluhan
              </a>
              <div className="my-3 border-t border-gray-100 dark:border-gray-800" />
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

      <main id="konten-utama" tabIndex={-1} className="outline-none">
      {/* HERO SECTION */}
      <section className="px-4 py-20 overflow-hidden text-white sm:px-6 sm:py-24 bg-gradient-to-br from-neutral-700 via-neutral-800 to-zinc-900">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          {/* Spanduk musiman: hanya tampil saat superadmin mengaktifkan tema. */}
          {temaMusiman !== 'NONE' && ucapanMusiman && (
            <RevealOnScroll delay={0}>
              <div className="musim-spanduk mx-auto flex max-w-2xl flex-col items-center gap-2 px-5 py-3 text-sm font-bold text-white shadow-lg rounded-2xl sm:flex-row sm:justify-center sm:gap-3">
                <IkonMusiman className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{ucapanMusiman}</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-white/20 rounded-full shrink-0">
                  {LABEL_TEMA[temaMusiman]}
                </span>
              </div>
            </RevealOnScroll>
          )}
          <RevealOnScroll delay={100}>
            {/* Responsif untuk teks hero */}
            <h2 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Kolaborasi Nyata Untuk <span className="text-red-700 dark:text-red-700">TEKNIK</span> <span className='text-amber-400'>Yang Lebih Baik</span>
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
              <a href="#berita" onClick={(e) => handleSmoothScroll(e, 'berita')} className="w-full px-6 py-3 font-bold transition-all duration-300 bg-white rounded-lg shadow-lg dark:bg-gray-900 sm:w-auto text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105 active:scale-95">Kabar Terbaru</a>
              <a href="#program" onClick={(e) => handleSmoothScroll(e, 'program')} className="w-full px-6 py-3 font-bold text-white transition-all duration-300 border rounded-lg sm:w-auto border-amber-300 dark:border-amber-700 bg-amber-400 hover:bg-amber-300 hover:scale-105 active:scale-95">Program Kerja</a>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* FITUR UTAMA */}
      <section className="relative z-10 max-w-6xl px-4 py-16 mx-auto -mt-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 sm:gap-8">
          <RevealOnScroll delay={200}>
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 dark:border-gray-800 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-blue-600 transition-transform duration-300 rounded-full dark:text-blue-400 w-14 h-14 bg-blue-50 dark:bg-blue-950/60 group-hover:scale-110"><Users className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Aspirasi Terpusat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Sampaikan keluhan langsung melalui sistem tiket yang transparan.</p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={400}>
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 dark:border-gray-800 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-green-600 transition-transform duration-300 rounded-full dark:text-green-400 w-14 h-14 bg-green-50 dark:bg-green-950/60 group-hover:scale-110"><ShieldCheck className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Validasi Terjamin</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Data mahasiswa yang tersinkronisasi dan aman secara sistematis.</p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={600}>
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 dark:border-gray-800 text-center hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 cursor-pointer group h-full">
              <div className="flex items-center justify-center mx-auto mb-4 text-purple-600 transition-transform duration-300 rounded-full dark:text-purple-400 w-14 h-14 bg-purple-50 dark:bg-purple-950/60 group-hover:scale-110"><Building className="w-7 h-7" /></div>
              <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Struktur Dinamis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kenali siapa saja yang bekerja di balik layar BEM FT UNAYA.</p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* --- SEJARAH TEKNIK --- */}
      <section id="sejarah" className="px-4 py-16 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800 sm:px-6 sm:py-20">
        <RevealOnScroll>
          <div className="flex flex-col items-center max-w-6xl gap-10 mx-auto md:flex-row">
            <div className="space-y-6 md:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                <Landmark className="w-4 h-4 shrink-0" /> Profil Fakultas
              </div>
              <h2 className="text-3xl font-black leading-tight text-gray-900 dark:text-gray-100 sm:text-4xl">Sejarah Singkat <br />Fakultas Teknik UNAYA</h2>
              <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400 sm:text-lg">
                Fakultas Teknik Universitas Abulyatama didirikan dengan tujuan mulia untuk mencetak insinyur dan tenaga ahli keteknikan yang unggul, berintegritas, dan siap berkontribusi dalam pembangunan bangsa.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                Seiring berjalannya waktu, BEM-FT hadir sebagai wadah perjuangan, inovasi, dan kreativitas mahasiswa teknik untuk menyalurkan gagasan dan menjaga tradisi solidaritas.
              </p>
              <div className="flex flex-wrap pt-2 gap-x-6 gap-y-3">
                <Link to="/about" className="inline-flex items-center gap-2 font-bold transition-all text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 hover:gap-3">
                  Lihat Struktur Kepengurusan <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
                <Link to="/demisioner" className="inline-flex items-center gap-2 font-bold text-gray-500 transition-all dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:gap-3">
                  Riwayat Demisioner <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>
            </div>
            <div className="w-full md:w-1/2">
              {/* Foto profil fakultas berbentuk potret. Foto ditampilkan utuh
                  (object-contain) dengan latar buram dari foto yang sama, supaya
                  tidak terpotong aneh saat ditaruh di kolom lebar. */}
              <div className="relative w-full overflow-hidden bg-gray-900 border border-gray-200 shadow-lg aspect-[4/5] sm:aspect-auto sm:h-[30rem] dark:border-gray-800 rounded-3xl">
                <img src="/fakultas-teknik-blur.jpg" alt="" aria-hidden="true" className="absolute inset-0 object-cover w-full h-full blur-2xl scale-110 opacity-60" />
                <LazyImage
                  src="/fakultas-teknik-900.webp"
                  srcSet="/fakultas-teknik-480.webp 480w, /fakultas-teknik-900.webp 900w, /fakultas-teknik.webp 1200w"
                  sizes="(min-width: 768px) 45vw, 92vw"
                  alt="Gedung Fakultas Teknik Universitas Abulyatama"
                  width={900}
                  height={1200}
                  className="relative z-10 object-contain w-full h-full"
                />
                <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-tr from-amber-900/30 to-transparent"></div>
              </div>
            </div>
          </div>
        </RevealOnScroll>

        {/* --- RIWAYAT DEMISIONER (CAROUSEL) --- */}
        {demisioner.length > 0 && (
          <RevealOnScroll>
            <div className="max-w-6xl mx-auto mt-16">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-gray-100 sm:text-2xl">
                    <Award className="w-6 h-6 text-amber-400 shrink-0" /> Riwayat Demisioner
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 sm:text-base">Jejak kepengurusan DPM &amp; BEM Teknik dari masa ke masa.</p>
                </div>
                <Link to="/demisioner" className="inline-flex items-center gap-2 text-sm font-bold text-amber-500 hover:text-amber-600 dark:hover:text-amber-300">
                  Lihat Semua <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Kartu carousel utama */}
                <div className="flex flex-col justify-between p-6 bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 lg:col-span-2 rounded-2xl sm:p-8">
                  {aktifDemo && (
                    <>
                      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                        {aktifDemo.foto ? (
                          <LazyImage src={assetUrl(aktifDemo.foto)} alt={aktifDemo.nama} className="object-cover w-24 h-24 rounded-full shadow-lg shrink-0 ring-4 ring-amber-50 dark:ring-amber-900/50" />
                        ) : (
                          <div className="flex items-center justify-center w-24 h-24 text-2xl font-black text-white rounded-full shadow-lg shrink-0 bg-amber-400">
                            {aktifDemo.nama.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                            {aktifDemo.organization}
                          </span>
                          <h3 className="mt-2 text-xl font-black text-gray-900 truncate dark:text-gray-100">{aktifDemo.nama}</h3>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{aktifDemo.nim}</p>
                          <p className="mt-1 text-xs font-bold uppercase text-amber-500">
                            {aktifDemo.jabatan ? `${aktifDemo.jabatan} • ` : ''}Periode {aktifDemo.periode}
                          </p>
                        </div>
                      </div>

                      {aktifDemo.description && (
                        <p className="mt-5 text-sm leading-relaxed text-gray-600 whitespace-pre-wrap dark:text-gray-400 line-clamp-5">
                          {aktifDemo.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-4 mt-6 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex gap-2">
                          <button onClick={() => geserDemo(-1)} aria-label="Demisioner sebelumnya" className="p-2 text-gray-600 transition bg-gray-100 rounded-full dark:text-gray-400 dark:bg-gray-800 hover:bg-amber-400 hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button onClick={() => geserDemo(1)} aria-label="Demisioner berikutnya" className="p-2 text-gray-600 transition bg-gray-100 rounded-full dark:text-gray-400 dark:bg-gray-800 hover:bg-amber-400 hover:text-white">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{demoIndex + 1} / {demisioner.length}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pemilih demisioner */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {demisioner.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => setDemoIndex(index)}
                      className={`flex items-center gap-3 p-3 text-left transition rounded-xl border ${
                        index === demoIndex ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 shadow-sm' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {item.foto ? (
                        <img src={assetUrl(item.foto)} alt={item.nama} loading="lazy" decoding="async" className="object-cover w-10 h-10 rounded-full shrink-0" />
                      ) : (
                        <div className="flex items-center justify-center w-10 h-10 text-xs font-black text-white rounded-full shrink-0 bg-amber-400">
                          {item.nama.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate dark:text-gray-100">{item.nama}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{item.jabatan || item.organization} • {item.periode}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        )}
      </section>

      {/* --- KONTEN DINAMIS UTAMA (PROGRAM & BERITA) --- */}
      <section className="px-4 py-16 border-t border-gray-200 dark:border-gray-800 sm:px-6 sm:py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto space-y-20 sm:space-y-24">

          {/* PROGRAM KERJA */}
          <RevealOnScroll>
            <div id="program">
              <div className="flex items-end justify-between mb-8">
                <h2 className="flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl"><Calendar className="text-amber-400 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Program Unggulan</h2>
              </div>
              {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
                : programs.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-800 rounded-2xl">Belum ada program kerja.</div>
                  : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {programs.map((prog, index) => (
                      <RevealOnScroll key={prog.id} delay={index * 200}>
                        <Link to={`/post/${prog.id}`} className="flex flex-col h-full overflow-hidden transition-all duration-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm cursor-pointer rounded-2xl hover:shadow-xl hover:-translate-y-1.5 active:scale-[0.98]">
                          {prog.image && (
                            <div className="w-full h-48 bg-gray-100 border-b border-gray-100 dark:bg-gray-800 dark:border-gray-800">
                              <LazyImage src={assetUrl(prog.image)} alt={prog.title} className="object-cover w-full h-full" />
                            </div>
                          )}
                          <div className="flex flex-col flex-grow p-6">
                            <span className="px-3 py-1 mb-4 text-xs font-bold text-purple-700 bg-purple-100 rounded-full dark:text-purple-300 dark:bg-purple-900/40 w-max">PROGRAM KERJA</span>
                            <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-gray-100">{prog.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">{prog.content}</p>
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
              <h2 className="flex items-center gap-2 mb-8 text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl"><Newspaper className="text-amber-400 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Kabar Terbaru</h2>
              {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
                : news.length === 0 ? <div className="p-10 text-center text-gray-500 bg-white border border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-800 rounded-2xl">Belum ada berita.</div>
                  : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {news.map((item, index) => (
                      <RevealOnScroll key={item.id} delay={index * 200}>
                        <Link to={`/post/${item.id}`} className="flex flex-col justify-between h-full overflow-hidden transition-all duration-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm cursor-pointer rounded-2xl group hover:shadow-xl hover:-translate-y-1.5 active:scale-[0.98]">
                          {item.image && (
                            <div className="relative w-full h-48 overflow-hidden bg-gray-100 dark:bg-gray-800">
                              <LazyImage src={assetUrl(item.image)} alt={item.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute inset-0 transition-opacity opacity-0 bg-gradient-to-t from-black/50 to-transparent group-hover:opacity-100"></div>
                            </div>
                          )}
                          <div className="flex flex-col flex-grow p-6">
                            <span className="px-3 py-1 mb-4 text-xs font-bold rounded-full text-amber-500 bg-amber-100 dark:bg-amber-900/40 w-max">{item.type}</span>
                            <h3 className="mb-3 text-xl font-bold text-gray-900 transition-colors dark:text-gray-100 group-hover:text-amber-400">{item.title}</h3>
                            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{item.content}</p>
                            <div className="flex items-center justify-between pt-4 mt-auto border-t border-gray-100 dark:border-gray-800">
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400"><p className="font-bold text-gray-900 dark:text-gray-100">{item.author.profile?.nama}</p><p>{new Date(item.createdAt).toLocaleDateString('id-ID')}</p></div>
                              <span aria-hidden="true" className="flex items-center justify-center w-8 h-8 transition-all duration-300 rounded-full text-amber-400 bg-gray-50 dark:bg-gray-800 shrink-0 group-hover:bg-amber-400 group-hover:text-white"><ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></span>
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
      <section id="agenda" className="px-4 py-16 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800 sm:px-6 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll>
            <div className="flex items-end justify-between mb-8 sm:mb-10">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl"><Clock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" /> Agenda Kegiatan</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">Jadwal acara dan kegiatan terdekat fakultas.</p>
              </div>
              <Link to="/agenda" className="items-center hidden gap-2 font-bold transition-colors md:flex text-amber-500 hover:text-amber-600 dark:hover:text-amber-300">Lihat Semua <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </RevealOnScroll>

          {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
            : agendas.length === 0 ? <div className="p-10 text-center text-gray-500 border border-gray-200 dark:text-gray-400 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 rounded-2xl">Belum ada agenda terdekat.</div>
              : <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {agendas.map((item, index) => (
                  <RevealOnScroll key={item.id} delay={index * 200}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAgenda(item)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgenda(item); } }}
                      className="flex flex-col h-full p-6 transition-all border border-gray-100 cursor-pointer dark:border-gray-800 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:shadow-lg hover:-translate-y-1 group focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-200 dark:border-gray-800">
                        {/* Menambahkan shrink-0 agar kotak tanggal tidak menyusut */}
                        <div className="flex items-center justify-center text-2xl font-black transition-colors shrink-0 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 w-14 h-14 rounded-xl group-hover:bg-amber-500 group-hover:text-white">
                          {new Date(item.date).getDate()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                            {jumlahHariAgenda(item.date, item.endDate) > 1
                              ? formatRentangTanggal(item.date, item.endDate)
                              : new Date(item.date).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-gray-100"><Clock className="w-3 h-3 shrink-0" /> {item.time} WIB</div>
                          {jumlahHariAgenda(item.date, item.endDate) > 1 && (
                            <div className="mt-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              Kegiatan {jumlahHariAgenda(item.date, item.endDate)} hari
                            </div>
                          )}
                        </div>
                      </div>
                      <h3 className="flex items-start gap-2 mb-2 text-lg font-bold text-gray-900 transition-colors dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-300">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color || '#F59E0B' }}
                        />
                        <span>{item.title}</span>
                      </h3>
                      <p className="flex-grow mb-4 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                      <div className="flex items-start gap-1 mt-auto text-xs font-bold text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" /> <span className="line-clamp-1">{item.location}</span>
                      </div>
                      {/* Tautan media sosial agenda terbuka untuk semua pengunjung. */}
                      {item.socialMediaLink && (
                        <a
                          href={item.socialMediaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-amber-600 transition-colors dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" /> Lihat di media sosial
                        </a>
                      )}
                    </div>
                  </RevealOnScroll>
                ))}
              </div>}
          <div className="mt-6 text-center md:hidden">
            <Link to="/agenda" className="inline-flex items-center gap-2 font-bold text-amber-500 hover:text-amber-600 dark:hover:text-amber-300">Lihat Semua Agenda <ArrowRight className="w-4 h-4" /></Link>
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
                <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 sm:text-base">Dokumentasi momen penting mahasiswa Teknik.</p>
              </div>
              <Link to="/gallery" className="items-center hidden gap-2 font-bold transition-colors md:flex text-amber-400 hover:text-amber-300">Lihat Semua <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </RevealOnScroll>

          {loadingContent ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
            : galleries.length === 0 ? <div className="p-10 text-center text-gray-500 border border-gray-800 dark:text-gray-400 rounded-2xl">Belum ada foto.</div>
              : <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {galleries.map((item, index) => (
                  <RevealOnScroll key={item.id} delay={index * 150}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedGallery(item); setGallerySlide(0); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedGallery(item); setGallerySlide(0); } }}
                      className="relative overflow-hidden bg-gray-800 border border-gray-700 shadow-lg cursor-pointer group rounded-2xl aspect-square hover:shadow-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <LazyImage src={assetUrl(item.url)} alt={item.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                      {fotoGaleri(item).length > 1 && (
                        <span className="absolute flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white rounded-lg top-2 right-2 bg-black/60 backdrop-blur-sm">
                          <Layers className="w-3 h-3" /> {fotoGaleri(item).length}
                        </span>
                      )}
                      <div className="absolute inset-0 flex flex-col justify-end p-3 transition-opacity opacity-0 sm:p-4 bg-gradient-to-t from-black/90 via-black/30 to-transparent group-hover:opacity-100">
                        <p className="text-xs font-bold text-white sm:text-sm line-clamp-2">{item.title}</p>
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

      {/* --- ASPIRASI & KELUHAN PUBLIK --- */}
      <section id="aspirasi" className="px-4 py-16 border-t border-gray-200 dark:border-gray-800 sm:px-6 sm:py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll>
            <div className="max-w-3xl mx-auto mb-10 text-center">
              <h2 className="flex items-center justify-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl">
                <Megaphone className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" /> Aspirasi &amp; Keluhan
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
                Aspirasi ditampilkan dengan nama dan NIM pengirim. Keluhan ditampilkan anonim demi melindungi pelapor.
              </p>
            </div>
          </RevealOnScroll>

          <div className="flex justify-center gap-2 mb-8">
            {([
              { key: 'ALL', label: 'Semua' },
              { key: 'ASPIRASI', label: 'Aspirasi' },
              { key: 'KELUHAN', label: 'Keluhan' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterTiket(f.key)}
                className={`px-4 py-2 text-sm font-bold rounded-full transition ${
                  filterTiket === f.key ? 'bg-amber-400 text-gray-900 shadow-md' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingContent ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
          ) : (() => {
            const daftarTiket = filterTiket === 'ALL'
              ? publicTickets
              : publicTickets.filter((t) => t.type === filterTiket);

            if (daftarTiket.length === 0) {
              return (
                <div className="p-10 text-center text-gray-500 bg-white border border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-800 rounded-2xl">
                  Belum ada {filterTiket === 'KELUHAN' ? 'keluhan' : filterTiket === 'ASPIRASI' ? 'aspirasi' : 'aspirasi atau keluhan'} yang tayang.
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {daftarTiket.map((tiket, index) => (
                  <RevealOnScroll key={tiket.id} delay={index * 120}>
                    <div className="flex flex-col h-full p-5 transition bg-white border border-gray-100 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-2xl hover:shadow-lg">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                          tiket.type === 'ASPIRASI' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        }`}>
                          {tiket.type}
                        </span>
                        {tiket.targetLabel && (
                          <span className="px-2.5 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-400 rounded-full bg-gray-100 dark:bg-gray-800">
                            {targetLabel(tiket.targetOrganization)}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(tiket.createdAt).toLocaleDateString('id-ID')}
                        </span>
                      </div>

                      <h3 className="mb-2 text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{tiket.title}</h3>
                      <p className="flex-grow mb-4 text-sm text-gray-600 whitespace-pre-wrap dark:text-gray-400 line-clamp-4">{tiket.content}</p>

                      {tiket.balasan.length > 0 && (
                        <div className="p-3 mb-3 border rounded-lg bg-amber-50/70 border-amber-100 dark:border-amber-900/60">
                          <p className="mb-1 text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-300">Tanggapan Resmi</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{tiket.balasan[tiket.balasan.length - 1].content}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-3 mt-auto border-t border-gray-100 dark:border-gray-800">
                        {tiket.anonim || !tiket.pengirim ? (
                          <>
                            <div className="flex items-center justify-center text-gray-500 bg-gray-100 rounded-full w-9 h-9 dark:text-gray-400 shrink-0 dark:bg-gray-800">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Anonim</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">Identitas dirahasiakan</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <UserAvatar
                              userId={tiket.pengirim.id}
                              nama={tiket.pengirim.nama || tiket.pengirim.nim}
                              foto={tiket.pengirim.foto ?? null}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate dark:text-gray-100">{tiket.pengirim.nama || 'Mahasiswa'}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">{tiket.pengirim.nim}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* --- BUKU TAMU & MENAMPILKAN KOMENTAR PUBLIK --- */}
      <section className="px-4 py-16 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-800 sm:px-6 sm:py-24">
        <RevealOnScroll>
          <div className="max-w-6xl mx-auto">
            
            <div className="max-w-2xl mx-auto mb-12 text-center sm:mb-16">
              <h2 className="flex items-center justify-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl"><MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0"/> Suara Publik</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">Tinggalkan pesan, dukungan, kritik, atau penawaran kerja sama kepada BEM FT UNAYA.</p>
            </div>

            <div className="grid items-start grid-cols-1 gap-12 lg:grid-cols-2">
              
              {/* KOLOM KIRI: DAFTAR KOMENTAR */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pb-4">
                {comments.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 border border-gray-200 dark:text-gray-400 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 rounded-2xl">Belum ada pesan publik. Jadilah yang pertama!</div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="p-5 border border-gray-100 shadow-sm dark:border-gray-800 sm:p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                      <p className="mb-4 italic leading-relaxed text-gray-700 dark:text-gray-300">"{comment.content}"</p>

                      {/* Balasan resmi pengurus/admin atas pesan ini */}
                      {comment.balasan.length > 0 && (
                        <div className="mb-4 space-y-3">
                          {comment.balasan.map(balasan => (
                            <div key={balasan.id} className="flex gap-2 pl-3 border-l-2 border-amber-300 dark:border-amber-700">
                              <CornerDownRight className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                                  Balasan {balasan.penulis}
                                  <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">• {new Date(balasan.createdAt).toLocaleDateString('id-ID')}</span>
                                </p>
                                <p className="mt-0.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">{balasan.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center justify-center w-10 h-10 text-lg font-black rounded-full shrink-0 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{comment.nama.charAt(0)}</div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-gray-900 truncate dark:text-gray-100">{comment.nama}</p>
                          <p className="text-xs text-gray-500 truncate dark:text-gray-400">{comment.asal_kampus} • {new Date(comment.createdAt).toLocaleDateString('id-ID')}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* KOLOM KANAN: FORM KIRIM PESAN */}
              <form onSubmit={handleSubmit} className="sticky p-6 space-y-5 bg-white border border-gray-100 shadow-xl dark:bg-gray-900 dark:border-gray-800 sm:p-8 rounded-3xl top-24">
                <h3 className="pb-2 text-xl font-bold border-b">Kirim Pesan</h3>
                {successMsg && <div className="flex items-center gap-2 p-4 text-sm font-bold text-green-800 bg-green-100 border rounded-lg dark:text-green-300 dark:bg-green-900/40"><ShieldCheck className="w-4 h-4 shrink-0"/> {successMsg}</div>}
                {errorMsg && <div className="p-4 text-sm font-bold text-red-800 bg-red-100 border rounded-lg dark:text-red-300 dark:bg-red-900/40">{errorMsg}</div>}
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <input required type="text" placeholder="Nama Lengkap" className="w-full p-3 border border-gray-300 rounded-lg outline-none dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                  <input required type="text" placeholder="Asal Instansi/Kampus" className="w-full p-3 border border-gray-300 rounded-lg outline-none dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500" value={formData.asal_kampus} onChange={e => setFormData({...formData, asal_kampus: e.target.value})} />
                  <input required type="email" placeholder="Alamat Email" className="w-full p-3 border border-gray-300 rounded-lg outline-none dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input required type="text" placeholder="No. HP / WhatsApp" className="w-full p-3 border border-gray-300 rounded-lg outline-none dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500" value={formData.no_hp} onChange={e => setFormData({...formData, no_hp: e.target.value})} />
                </div>
                <textarea required rows={4} placeholder="Tuliskan pesan Anda di sini..." className="w-full p-3 border border-gray-300 rounded-lg outline-none resize-none dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
                
                <button type="submit" disabled={isSubmitting} className="flex items-center justify-center w-full gap-2 py-3 font-bold text-white transition-all duration-200 rounded-lg bg-amber-400 hover:bg-amber-500 hover:shadow-lg active:scale-95">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Send className="w-5 h-5 shrink-0" /> Kirim Pesan Publik</>}
                </button>
              </form>
            </div>
          </div>
        </RevealOnScroll>
      </section>
      </main>

      {/* --- FOOTER --- */}
      <footer className="px-4 py-8 mt-auto text-sm text-center text-gray-400 bg-gray-900 border-t border-gray-800 dark:text-gray-500 sm:px-6 sm:py-10">
        <RevealOnScroll>
          <div className="flex flex-col items-center justify-between max-w-6xl gap-4 mx-auto md:flex-row">
            <div className="text-center md:text-left"><h3 className="text-lg font-bold text-white">BEM FT UNAYA</h3></div>
            <div className="text-center md:text-right">
              <p>© 2026 Hak Cipta Dilindungi.</p>
              <p className="mt-1">Dibuat oleh <span className="font-bold text-amber-400">Hafiz Syauqi</span></p>
            </div>
          </div>
        </RevealOnScroll>
      </footer>

      {/* --- MODAL AGENDA --- */}
      {selectedAgenda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedAgenda(null)}>
          <div role="dialog" aria-modal="true" aria-label="Detail agenda" className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto duration-200 bg-white shadow-2xl dark:bg-gray-900 rounded-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedAgenda(null)} aria-label="Tutup" className="absolute z-10 p-2 text-gray-500 transition-colors bg-gray-100 rounded-full dark:text-gray-400 dark:bg-gray-800 top-4 right-4 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"><X className="w-5 h-5" /></button>

            <div className="p-6 pt-10 text-center sm:p-8 bg-amber-400">
              <div className="flex flex-col items-center justify-center w-20 h-20 mx-auto mb-4 text-3xl font-black bg-white shadow-lg dark:bg-gray-900 sm:w-24 sm:h-24 sm:text-4xl text-amber-600 dark:text-amber-300 rounded-2xl">
                <span className="text-2xl sm:text-3xl">{new Date(selectedAgenda.date).getDate()}</span>
                <span className="text-[10px] sm:text-xs font-bold uppercase">{new Date(selectedAgenda.date).toLocaleString('id-ID', { month: 'short' })}</span>
              </div>
              <h2 className="text-xl font-black text-white sm:text-2xl">{selectedAgenda.title}</h2>
            </div>

            <div className="p-6 space-y-6 sm:p-8">
              <div className="flex flex-col gap-3 p-4 text-xs font-medium text-gray-700 border border-gray-100 dark:text-gray-300 dark:border-gray-800 sm:text-sm bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span>
                    {formatRentangTanggal(selectedAgenda.date, selectedAgenda.endDate)}
                    {jumlahHariAgenda(selectedAgenda.date, selectedAgenda.endDate) > 1 && (
                      <span className="block mt-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        Berlangsung {jumlahHariAgenda(selectedAgenda.date, selectedAgenda.endDate)} hari
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3"><Clock className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" /> Pukul {selectedAgenda.time} WIB - Selesai</div>
                <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" /> <span>{selectedAgenda.location}</span></div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">Deskripsi Kegiatan</h3>
                <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap dark:text-gray-400">{selectedAgenda.description}</p>
              </div>

              {selectedAgenda.socialMediaLink && (
                <a
                  href={selectedAgenda.socialMediaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full gap-2 py-3 font-bold transition-colors border-2 border-amber-400 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-400 hover:text-white dark:hover:text-gray-900"
                >
                  Lihat Postingan Media Sosial <Share2 className="w-4 h-4" />
                </a>
              )}

              {selectedAgenda.registrationLink && (
                isMahasiswaOrAbove(user?.role) ? (
                  <a href={selectedAgenda.registrationLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full gap-2 py-3 mt-4 font-bold text-white transition-all shadow-md bg-amber-400 rounded-xl hover:bg-amber-500 active:scale-95">
                    Daftar / Ikuti Kegiatan <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="flex flex-col gap-2 p-4 mt-4 text-sm border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
                    <p className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                      <Lock className="w-4 h-4 shrink-0" /> Pendaftaran khusus mahasiswa
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Masuk dengan akun mahasiswa untuk melihat tautan pendaftaran kegiatan ini.
                    </p>
                    <Link to="/login" className="inline-flex items-center justify-center w-full gap-2 py-2 mt-1 font-bold text-white transition-colors bg-amber-400 rounded-lg hover:bg-amber-500">
                      <LogIn className="w-4 h-4" /> Masuk untuk mendaftar
                    </Link>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL GALERI --- */}
      {selectedGallery && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 overflow-y-auto sm:items-center sm:p-4 bg-gray-900/90 backdrop-blur-md transition-opacity" onClick={() => setSelectedGallery(null)}>
          <button onClick={() => setSelectedGallery(null)} aria-label="Tutup" className="absolute z-10 p-2 text-white transition-colors rounded-full top-4 right-4 sm:top-6 sm:right-6 bg-white/10 hover:bg-red-500 backdrop-blur-sm"><X className="w-6 h-6" /></button>

          <div role="dialog" aria-modal="true" aria-label="Foto galeri" className="flex flex-col w-full max-w-5xl my-8 overflow-hidden duration-200 bg-black shadow-2xl rounded-2xl animate-in zoom-in-95 sm:my-0" onClick={e => e.stopPropagation()}>
            <div className="relative w-full h-[40vh] sm:h-[55vh] bg-black flex items-center justify-center">
              {(() => {
                const foto = fotoGaleri(selectedGallery);
                const geser = (arah: number) => setGallerySlide((prev) => (prev + arah + foto.length) % foto.length);
                return (
                  <>
                    <img src={assetUrl(foto[gallerySlide] ?? foto[0])} alt={selectedGallery.title} className="object-contain max-w-full max-h-full" />
                    {foto.length > 1 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); geser(-1); }} aria-label="Foto sebelumnya" className="absolute p-2 text-white transition rounded-full left-3 bg-white/10 hover:bg-amber-400 hover:text-gray-900 dark:hover:text-gray-100">
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); geser(1); }} aria-label="Foto berikutnya" className="absolute p-2 text-white transition rounded-full right-3 bg-white/10 hover:bg-amber-400 hover:text-gray-900 dark:hover:text-gray-100">
                          <ChevronRight className="w-6 h-6" />
                        </button>
                        <span className="absolute px-3 py-1 text-xs font-bold text-white rounded-full bottom-3 right-3 bg-black/60 backdrop-blur-sm">
                          {gallerySlide + 1} / {foto.length}
                        </span>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Thumbnail carousel */}
            {(() => {
              const foto = fotoGaleri(selectedGallery);
              if (foto.length <= 1) return null;
              return (
                <div className="flex gap-2 p-3 overflow-x-auto border-t border-gray-800 bg-gray-950">
                  {foto.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      onClick={(e) => { e.stopPropagation(); setGallerySlide(i); }}
                      className={`w-16 h-16 overflow-hidden rounded-lg shrink-0 border-2 transition ${i === gallerySlide ? 'border-amber-400' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={assetUrl(url)} alt={`Thumbnail ${i + 1}`} className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              );
            })()}

            <div className="flex flex-col items-start justify-between gap-4 p-5 bg-gray-900 border-t border-gray-800 sm:p-6 sm:flex-row sm:items-center">
              <div className="w-full">
                <h3 className="text-base font-bold text-white sm:text-lg lg:text-xl line-clamp-2">{selectedGallery.title}</h3>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 sm:text-sm">{selectedGallery.activity || 'Dokumentasi Umum'} • {selectedGallery.year}</p>
              </div>
              <span className="px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider uppercase border rounded-full shrink-0 bg-amber-400/10 text-amber-400 border-amber-400/20 whitespace-nowrap">
                {selectedGallery.category}
              </span>
            </div>

            <GalleryComments key={selectedGallery.id} galleryId={selectedGallery.id} />
          </div>
        </div>
      )}

    </div>
  );
}