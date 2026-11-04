import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/axios';
import { useProfileDialog } from '../contexts/ProfileDialogContext';
import { Search, Loader2, Users, Ticket, Building2, UserCog, FileText, CornerDownLeft } from 'lucide-react';

interface Hasil {
  tipe: 'mahasiswa' | 'tiket' | 'organisasi' | 'posisi' | 'halaman';
  id: string;
  judul: string;
  keterangan: string;
  url: string;
}

const IKON: Record<Hasil['tipe'], typeof Users> = {
  mahasiswa: Users,
  tiket: Ticket,
  organisasi: Building2,
  posisi: UserCog,
  halaman: FileText,
};

const LABEL: Record<Hasil['tipe'], string> = {
  mahasiswa: 'Mahasiswa',
  tiket: 'Tiket',
  organisasi: 'Organisasi',
  posisi: 'Jabatan',
  halaman: 'Halaman',
};

/**
 * Pencarian global (Ctrl/⌘+K). Hasil mahasiswa langsung membuka dialog profil;
 * hasil lain berpindah halaman. Hanya tersedia setelah login karena endpoint
 * pencarian membutuhkan sesi.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { bukaProfil } = useProfileDialog();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [loading, setLoading] = useState(false);
  const [aktif, setAktif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    // Semua perubahan state (termasuk pembersihan) dijalankan di dalam
    // callback timer, bukan sinkron di badan effect. Pembersihan memakai
    // jeda 0 ms agar tetap terjadi segera setelah effect dijalankan.
    const kosong = !open || q.trim().length < 2;
    let batal = false;

    const timer = window.setTimeout(async () => {
      if (kosong) {
        setHasil([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get('/search', { params: { q: q.trim() } });
        if (!batal) {
          setHasil(res.data.data);
          setAktif(0);
        }
      } catch (error) {
        console.error(error);
        if (!batal) setHasil([]);
      } finally {
        if (!batal) setLoading(false);
      }
    }, kosong ? 0 : 250);

    return () => {
      batal = true;
      window.clearTimeout(timer);
    };
  }, [q, open]);

  const pilih = (item: Hasil) => {
    setOpen(false);
    setQ('');
    if (item.tipe === 'mahasiswa') bukaProfil(item.id);
    else navigate(item.url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800 sm:flex"
        aria-label="Buka pencarian global"
      >
        <Search className="w-4 h-4" />
        <span className="hidden lg:inline">Cari…</span>
        <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] font-bold border border-gray-300 rounded dark:border-gray-600">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-3 text-gray-500 rounded-full hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 sm:hidden"
        aria-label="Buka pencarian global"
      >
        <Search className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian global"
          className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh] bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl dark:bg-gray-900 dark:border-gray-800"
          >
            <div className="flex items-center gap-2 px-4 border-b border-gray-100 dark:border-gray-800">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAktif((i) => Math.min(hasil.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAktif((i) => Math.max(0, i - 1));
                  } else if (e.key === 'Enter' && hasil[aktif]) {
                    e.preventDefault();
                    pilih(hasil[aktif]);
                  }
                }}
                placeholder="Cari NIM, nama, nomor tiket, organisasi, atau halaman…"
                className="flex-1 py-4 text-sm bg-transparent outline-none dark:text-gray-100"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
              <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-gray-400 border border-gray-300 rounded dark:border-gray-600">Esc</kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="p-6 text-sm text-center text-gray-500 dark:text-gray-400">
                  Ketik minimal 2 karakter. Gunakan ↑ ↓ untuk memilih dan Enter untuk membuka.
                </p>
              ) : !loading && hasil.length === 0 ? (
                <p className="p-6 text-sm text-center text-gray-500 dark:text-gray-400">
                  Tidak ada hasil untuk “{q.trim()}”.
                </p>
              ) : (
                <ul className="py-2">
                  {hasil.map((item, i) => {
                    const Icon = IKON[item.tipe];
                    return (
                      <li key={`${item.tipe}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => pilih(item)}
                          onMouseEnter={() => setAktif(i)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${aktif === i ? 'bg-amber-50 dark:bg-amber-950/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                          <span className="flex items-center justify-center w-8 h-8 mt-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900 truncate dark:text-gray-100">{item.judul}</span>
                              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">{LABEL[item.tipe]}</span>
                            </span>
                            <span className="block text-xs text-gray-500 truncate dark:text-gray-400">{item.keterangan}</span>
                          </span>
                          {aktif === i && <CornerDownLeft className="w-4 h-4 mt-2 text-gray-400 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
