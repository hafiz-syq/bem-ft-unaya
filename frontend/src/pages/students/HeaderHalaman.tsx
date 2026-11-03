import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Download, Loader2, Search, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import type { Meta } from './data-mahasiswa';

interface Props {
  meta: Meta | null;
  angkatan: number | null;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  handleSearch: (e: FormEvent) => void;
  isAdmin: boolean;
  isSuperadmin: boolean;
  exporting: boolean;
  handleExportCsv: () => void;
  bukaTambah: () => void;
  bukaTambahAdmin: () => void;
  bukaImpor: () => void;
}

/** Judul halaman, kotak pencarian, dan tombol aksi pengelola. */
export default function HeaderHalaman({
  meta,
  angkatan,
  search,
  setSearch,
  handleSearch,
  isAdmin,
  isSuperadmin,
  exporting,
  handleExportCsv,
  bukaTambah,
  bukaTambahAdmin,
  bukaImpor,
}: Props) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Mahasiswa</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {meta?.hanyaBaca
            ? `Direktori ${meta?.total || 0} mahasiswa aktif${angkatan ? ` angkatan ${angkatan}` : ''}. Data kontak akun hanya terlihat oleh pengelola.`
            : `Total ${meta?.total || 0} akun ${angkatan ? `angkatan ${angkatan}` : 'terdaftar di sistem'}.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Cari NIM atau Nama..."
              className="block w-full py-2 pr-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg pl-9 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500 focus:ring-amber-300 focus:border-amber-300"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-gray-900 transition rounded-lg bg-amber-400 hover:bg-amber-500"
          >
            Cari
          </button>
        </form>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={bukaImpor}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold transition rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40"
            >
              <Upload className="w-4 h-4" /> Impor PDF
            </button>
            <button
              type="button"
              onClick={bukaTambah}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 transition rounded-lg bg-amber-400 hover:bg-amber-500"
            >
              <UserPlus className="w-4 h-4" /> Tambah
            </button>
            {isSuperadmin && (
              <button
                type="button"
                onClick={bukaTambahAdmin}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-purple-700 transition rounded-lg bg-purple-50 hover:bg-purple-100 dark:text-purple-300 dark:bg-purple-950/60 dark:hover:bg-purple-900/40"
              >
                <ShieldCheck className="w-4 h-4" /> Tambah Admin
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold transition rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ekspor CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
