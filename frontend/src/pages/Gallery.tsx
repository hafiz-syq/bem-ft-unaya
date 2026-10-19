import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import {
  Loader2, Code2, ArrowLeft, ChevronLeft, ChevronRight, Images, X, Layers,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import GalleryComments from '../components/GalleryComments';

interface GalleryImage {
  id: string;
  url: string;
  order: number;
}

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  url: string;
  activity: string | null;
  year: number;
  images?: GalleryImage[];
}

export default function Gallery() {
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [slide, setSlide] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    api.get('/cms/galleries')
      .then(res => setGalleries(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  /** Daftar foto sebuah postingan: pakai relasi images, fallback ke cover lama. */
  const fotoPostingan = (item: GalleryItem): string[] =>
    item.images && item.images.length > 0 ? item.images.map((img) => img.url) : [item.url];

  const fotoTerpilih = useMemo(
    () => (selected ? fotoPostingan(selected) : []),
    [selected]
  );

  const bukaModal = (item: GalleryItem) => {
    setSelected(item);
    setSlide(0);
  };

  /**
   * Menggeser carousel satu foto ke kiri/kanan dengan animasi halus.
   * Carousel-nya sendiri adalah kontainer scroll ber-snap, jadi geseran jari
   * di layar sentuh dan swipe trackpad sudah mulus tanpa kode tambahan.
   */
  const geser = useCallback((arah: number) => {
    const el = trackRef.current;
    if (!el || fotoTerpilih.length === 0) return;

    const berikutnya = (slide + arah + fotoTerpilih.length) % fotoTerpilih.length;
    el.scrollTo({ left: berikutnya * el.clientWidth, behavior: 'smooth' });
    setSlide(berikutnya);
  }, [slide, fotoTerpilih.length]);

  /** Sinkronkan nomor slide saat pengguna menggeser sendiri. */
  const saatScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const indeks = Math.round(el.scrollLeft / el.clientWidth);
    setSlide(Math.min(Math.max(indeks, 0), Math.max(fotoTerpilih.length - 1, 0)));
  };

  /** Lompat ke foto tertentu (thumbnail) dengan scroll halus. */
  const pilihSlide = (indeks: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: indeks * el.clientWidth, behavior: 'smooth' });
    setSlide(indeks);
  };

  // Panah kiri/kanan di keyboard saat modal terbuka.
  useEffect(() => {
    if (!selected) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === 'ArrowLeft') geser(-1);
      if (e.key === 'ArrowRight') geser(1);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, geser]);

  // Thumbnail aktif ikut digulir ke area terlihat.
  useEffect(() => {
    thumbRefs.current[slide]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [slide]);

  return (
    <div className="min-h-screen font-sans bg-gray-50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95"><Code2 className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-black text-gray-900 dark:text-gray-100">BEM FT UNAYA</h1><p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Portal Resmi</p></div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors hover:text-amber-400"><ArrowLeft className="w-4 h-4" /> Kembali</Link>
        <ThemeToggle />
      </nav>

      <main className="max-w-6xl px-6 py-12 mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-black text-gray-900 dark:text-gray-100">Galeri Dokumentasi</h2>
          <p className="text-lg text-gray-500 dark:text-gray-400">Momen penting dan rekam jejak kegiatan mahasiswa Teknik.</p>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
          : galleries.length === 0 ? <div className="p-12 font-medium text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">Belum ada dokumentasi publik.</div>
            : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {galleries.map(item => {
                const jumlah = fotoPostingan(item).length;
                return (
                  <button
                    key={item.id}
                    onClick={() => bukaModal(item)}
                    className="overflow-hidden text-left transition-all bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl group hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="relative h-56 overflow-hidden bg-gray-200 dark:bg-gray-700">
                      <img src={assetUrl(item.url)} alt={item.title} loading="lazy" decoding="async" className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">{item.category}</div>
                      {jumlah > 1 && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white rounded-lg bg-black/60 backdrop-blur-sm">
                          <Layers className="w-3 h-3" /> {jumlah} foto
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="mb-1 font-bold text-gray-900 dark:text-gray-100 truncate">{item.title}</h3>
                      <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                        <span className="truncate max-w-[120px]">{item.activity || 'Umum'}</span>
                        <span>{item.year}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>}
      </main>

      {/* MODAL CAROUSEL + KOMENTAR */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 overflow-y-auto sm:p-4 bg-gray-900/90 backdrop-blur-md sm:items-center" onClick={() => setSelected(null)}>
          <button onClick={() => setSelected(null)} className="fixed z-20 p-2 text-white transition-colors rounded-full top-4 right-4 sm:top-6 sm:right-6 bg-white/10 hover:bg-red-500 backdrop-blur-sm" aria-label="Tutup"><X className="w-6 h-6" /></button>

          <div role="dialog" aria-modal="true" aria-label="Foto galeri" className="flex flex-col w-full max-w-5xl my-8 overflow-hidden bg-black shadow-2xl rounded-2xl sm:my-0" onClick={e => e.stopPropagation()}>
            <div className="relative flex items-center justify-center w-full h-[45vh] bg-black sm:h-[60vh]">
              {/* Track carousel: scroll-snap + scroll halus */}
              <div
                ref={trackRef}
                onScroll={saatScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
              >
                {fotoTerpilih.map((url, i) => (
                  <div key={`${url}-${i}`} className="flex items-center justify-center w-full h-full shrink-0 snap-center">
                    <img
                      src={assetUrl(url)}
                      alt={`${selected.title} ${i + 1}`}
                      className="object-contain max-w-full max-h-full"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {fotoTerpilih.length > 1 && (
                <>
                  <button onClick={() => geser(-1)} aria-label="Foto sebelumnya" className="absolute z-10 p-2 text-white transition rounded-full left-3 bg-white/10 hover:bg-amber-400 hover:text-gray-900">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={() => geser(1)} aria-label="Foto berikutnya" className="absolute z-10 p-2 text-white transition rounded-full right-3 bg-white/10 hover:bg-amber-400 hover:text-gray-900">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <span className="absolute z-10 px-3 py-1 text-xs font-bold text-white rounded-full bottom-3 right-3 bg-black/60 backdrop-blur-sm">
                    {slide + 1} / {fotoTerpilih.length}
                  </span>
                </>
              )}
            </div>

            {/* Thumbnail carousel */}
            {fotoTerpilih.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-gray-900 border-t border-gray-800 scroll-smooth">
                {fotoTerpilih.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    ref={(el) => { thumbRefs.current[i] = el; }}
                    onClick={() => pilihSlide(i)}
                    aria-label={`Lihat foto ${i + 1}`}
                    className={`w-16 h-16 overflow-hidden rounded-lg shrink-0 border-2 transition ${i === slide ? 'border-amber-400' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={assetUrl(url)} alt={`Thumbnail ${i + 1}`} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col items-start justify-between gap-4 p-5 bg-gray-900 border-t border-gray-800 sm:p-6 sm:flex-row sm:items-center">
              <div className="w-full">
                <h3 className="text-base font-bold text-white sm:text-lg lg:text-xl line-clamp-2">{selected.title}</h3>
                <p className="mt-1 text-xs text-gray-400 sm:text-sm">{selected.activity || 'Dokumentasi Umum'} • {selected.year}</p>
              </div>
              <span className="flex items-center gap-1 px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider uppercase border rounded-full shrink-0 bg-amber-400/10 text-amber-400 border-amber-400/20 whitespace-nowrap">
                <Images className="w-3.5 h-3.5" /> {selected.category}
              </span>
            </div>

            <GalleryComments key={selected.id} galleryId={selected.id} />
          </div>
        </div>
      )}
    </div>
  );
}
