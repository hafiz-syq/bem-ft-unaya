import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import {
  Loader2, Code2, ArrowLeft, Award, ChevronLeft, ChevronRight, BadgeCheck, Building2, Quote
} from 'lucide-react';

interface DemisionerItem {
  id: string;
  organization: string;
  nama: string;
  nim: string;
  jabatan: string | null;
  periode: string;
  foto: string | null;
  description: string | null;
}

const FILTER = [
  { key: 'ALL', label: 'Semua' },
  { key: 'BEM', label: 'BEM Teknik' },
  { key: 'DPM', label: 'DPM' },
];

export default function Demisioner() {
  const [data, setData] = useState<DemisionerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api.get('/demisioner')
      .then((res) => setData(res.data.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const daftar = useMemo(
    () => (filter === 'ALL' ? data : data.filter((d) => d.organization === filter)),
    [data, filter]
  );

  // Index carousel dijaga tetap valid setiap filter berubah.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(0);
  }, [filter]);

  const aktif = daftar[index];

  const geser = (arah: number) => {
    if (daftar.length === 0) return;
    setIndex((prev) => (prev + arah + daftar.length) % daftar.length);
  };

  return (
    <div className="min-h-screen font-sans bg-gray-50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-lg shadow-lg bg-amber-400 group-hover:scale-95">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">BEM FT UNAYA</h1>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Portal Resmi</p>
          </div>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors hover:text-amber-400">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
      </nav>

      <main className="max-w-6xl px-6 py-12 mx-auto">
        <div className="max-w-3xl mx-auto mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-bold tracking-wider uppercase rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            <Award className="w-4 h-4 shrink-0" /> Jejak Kepengurusan
          </div>
          <h2 className="mb-4 text-3xl font-black text-gray-900 dark:text-gray-100 sm:text-4xl">Riwayat Demisioner</h2>
          <p className="text-base text-gray-500 dark:text-gray-400 sm:text-lg">
            Rekam jejak para pengurus DPM &amp; BEM Fakultas Teknik Universitas Abulyatama dari masa ke masa.
          </p>
        </div>

        {/* Filter organisasi */}
        <div className="flex justify-center gap-2 mb-10">
          {FILTER.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-sm font-bold rounded-full transition ${
                filter === f.key ? 'bg-amber-400 text-white shadow-md' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-amber-400 animate-spin" /></div>
        ) : daftar.length === 0 ? (
          <div className="p-12 font-medium text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
            Belum ada data demisioner untuk kategori ini.
          </div>
        ) : (
          <>
            {/* CAROUSEL */}
            <div className="relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl rounded-3xl">
              <div className="grid grid-cols-1 md:grid-cols-5">
                {/* Foto */}
                <div className="relative flex items-center justify-center p-8 md:col-span-2 bg-gradient-to-br from-amber-400 to-orange-400">
                  {aktif.foto ? (
                    <img
                      src={assetUrl(aktif.foto)}
                      alt={aktif.nama}
                      className="object-cover w-40 h-40 rounded-full shadow-2xl ring-4 ring-white/40 sm:w-48 sm:h-48"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-40 h-40 text-4xl font-black text-amber-500 bg-white dark:bg-gray-900 rounded-full shadow-2xl sm:w-48 sm:h-48">
                      {aktif.nama.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute top-4 left-4 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase rounded-full bg-black/25 backdrop-blur-sm">
                    {aktif.organization}
                  </span>
                </div>

                {/* Biodata & sejarah singkat */}
                <div className="flex flex-col justify-center p-8 md:col-span-3">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 sm:text-3xl">{aktif.nama}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      <BadgeCheck className="w-3.5 h-3.5" /> {aktif.nim}
                    </span>
                    <span className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      <Building2 className="w-3.5 h-3.5" /> Periode {aktif.periode}
                    </span>
                  </div>
                  {aktif.jabatan && (
                    <p className="mt-3 text-sm font-bold tracking-wide uppercase text-amber-500">{aktif.jabatan}</p>
                  )}

                  {aktif.description ? (
                    <div className="relative mt-5">
                      <Quote className="absolute w-8 h-8 text-amber-100 -top-2 -left-2" />
                      <p className="relative text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-wrap sm:text-base">
                        {aktif.description}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm italic text-gray-400 dark:text-gray-500">Belum ada catatan sejarah singkat untuk demisioner ini.</p>
                  )}
                </div>
              </div>

              {/* Kontrol carousel */}
              <button
                onClick={() => geser(-1)}
                aria-label="Demisioner sebelumnya"
                className="absolute p-2 text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 rounded-full shadow-lg top-1/2 left-3 -translate-y-1/2 hover:bg-amber-400 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => geser(1)}
                aria-label="Demisioner berikutnya"
                className="absolute p-2 text-gray-700 dark:text-gray-300 transition bg-white dark:bg-gray-900 rounded-full shadow-lg top-1/2 right-3 -translate-y-1/2 hover:bg-amber-400 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Titik navigasi */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {daftar.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Lihat ${item.nama}`}
                  className={`h-2.5 rounded-full transition-all ${
                    i === index ? 'w-8 bg-amber-400' : 'w-2.5 bg-gray-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  }`}
                />
              ))}
            </div>

            {/* Grid semua demisioner */}
            <div className="grid grid-cols-2 gap-4 mt-12 sm:grid-cols-3 lg:grid-cols-4">
              {daftar.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  className={`p-4 text-center transition-all bg-white dark:bg-gray-900 border shadow-sm rounded-2xl hover:-translate-y-1 hover:shadow-lg ${
                    i === index ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-200 dark:ring-amber-800' : 'border-gray-100 dark:border-gray-800'
                  }`}
                >
                  {item.foto ? (
                    <img src={assetUrl(item.foto)} alt={item.nama} className="object-cover w-16 h-16 mx-auto mb-3 rounded-full ring-2 ring-amber-50 dark:ring-amber-900/50" />
                  ) : (
                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 text-lg font-black text-white rounded-full bg-amber-400">
                      {item.nama.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{item.nama}</h4>
                  <p className="text-[10px] font-bold tracking-wider uppercase text-amber-500 truncate">{item.jabatan || item.organization}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{item.periode}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
