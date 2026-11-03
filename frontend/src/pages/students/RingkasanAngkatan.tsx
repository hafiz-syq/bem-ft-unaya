import type { Dispatch, SetStateAction } from 'react';
import { GraduationCap } from 'lucide-react';
import type { Meta } from './data-mahasiswa';

interface Props {
  meta: Meta;
  angkatan: number | null;
  setAngkatan: Dispatch<SetStateAction<number | null>>;
  ubahFilter: (ubah: () => void) => void;
}

/** Ringkasan jumlah mahasiswa per angkatan; dihitung server dari seluruh baris
    yang cocok dengan filter, bukan hanya halaman yang tampil. */
export default function RingkasanAngkatan({ meta, angkatan, setAngkatan, ubahFilter }: Props) {
  const perAngkatan = meta.perAngkatan || [];

  return (
    <section
      aria-labelledby="ringkasan-angkatan"
      className="bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <div>
          <h2
            id="ringkasan-angkatan"
            className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100"
          >
            <GraduationCap className="w-5 h-5 text-amber-400" /> Jumlah Mahasiswa per Angkatan
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Dibaca dari 2 digit pertama NIM dan mengikuti filter yang aktif.
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-bold rounded-full text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60">
          {perAngkatan.reduce((jumlah, item) => jumlah + item.jumlah, 0)} mahasiswa •{' '}
          {perAngkatan.length} angkatan
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
        {perAngkatan.map(({ angkatan: tahun, jumlah }) => {
          const aktif = angkatan === tahun;
          return (
            <li key={tahun}>
              <button
                type="button"
                onClick={() => ubahFilter(() => setAngkatan(aktif ? null : tahun))}
                aria-pressed={aktif}
                title={aktif ? `Hapus filter angkatan ${tahun}` : `Tampilkan hanya angkatan ${tahun}`}
                className={`w-full h-full p-4 text-left transition border rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${aktif
                  ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400 dark:border-amber-500/70 dark:bg-amber-950/50'
                  : 'border-gray-200 bg-gray-50/70 hover:border-amber-300 hover:bg-amber-50/60 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-amber-500/60 dark:hover:bg-amber-950/30'
                  }`}
              >
                <span className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-wide uppercase text-gray-500 dark:text-gray-400">
                  Angkatan
                  {aktif && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold normal-case rounded-full text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/60">
                      aktif
                    </span>
                  )}
                </span>
                <span className="block text-xl font-black text-gray-900 dark:text-gray-100">{tahun}</span>
                <span className="block mt-1 text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-bold text-amber-600 dark:text-amber-300">{jumlah}</span> mahasiswa
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
