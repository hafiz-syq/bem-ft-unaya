import type { Dispatch, SetStateAction } from 'react';
import { Loader2, Power, Smartphone, Trash2, X } from 'lucide-react';
import { ROLE_LABEL } from '../../lib/roles';

interface Props {
  jumlah: number;
  bulkBusy: boolean;
  bulkRole: string;
  setBulkRole: Dispatch<SetStateAction<string>>;
  isSuperadmin: boolean;
  opsiRoleBaru: string[];
  jalankanBulk: (action: string, role?: string) => void;
  setDipilih: Dispatch<SetStateAction<Set<string>>>;
}

/** Bilah aksi massal untuk akun yang sedang dipilih. */
export default function BilahAksiMassal({
  jumlah,
  bulkBusy,
  bulkRole,
  setBulkRole,
  isSuperadmin,
  opsiRoleBaru,
  jalankanBulk,
  setDipilih,
}: Props) {
  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 p-3 bg-amber-50 border border-amber-200 shadow-sm rounded-xl dark:bg-amber-950/60 dark:border-amber-900">
      <span className="mr-1 text-sm font-bold text-amber-800 dark:text-amber-200">
        {jumlah} akun dipilih
      </span>
      <button
        type="button"
        onClick={() => jalankanBulk('AKTIFKAN')}
        disabled={bulkBusy}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-300 dark:bg-green-900/50 disabled:opacity-50"
      >
        <Power className="w-3.5 h-3.5" /> Aktifkan
      </button>
      <button
        type="button"
        onClick={() => jalankanBulk('NONAKTIFKAN')}
        disabled={bulkBusy}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-700 disabled:opacity-50"
      >
        <Power className="w-3.5 h-3.5" /> Nonaktifkan
      </button>
      <button
        type="button"
        onClick={() => jalankanBulk('PUTUS_PERANGKAT')}
        disabled={bulkBusy}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-950/60 disabled:opacity-50"
      >
        <Smartphone className="w-3.5 h-3.5" /> Putus perangkat
      </button>
      {isSuperadmin && (
        <>
          <span className="flex items-center gap-1 ml-1">
            <select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              className="px-2 py-1.5 text-xs font-bold bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
            >
              {opsiRoleBaru.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => jalankanBulk('UBAH_ROLE', bulkRole)}
              disabled={bulkBusy}
              className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 dark:text-amber-200 dark:bg-amber-900/50 disabled:opacity-50"
            >
              Terapkan role
            </button>
          </span>
          <button
            type="button"
            onClick={() => jalankanBulk('HAPUS')}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-red-950/60 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        </>
      )}
      {bulkBusy && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
      <button
        type="button"
        onClick={() => setDipilih(new Set())}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-gray-500 rounded-lg hover:bg-white/60 dark:text-gray-400"
      >
        <X className="w-3.5 h-3.5" /> Batal pilih
      </button>
    </div>
  );
}
