import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { ROLE_LABEL } from '../../lib/roles';
import { STATUS_OPTIONS } from './data-mahasiswa';

interface Props {
  isAdmin: boolean;
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  role: string;
  setRole: Dispatch<SetStateAction<string>>;
  opsiFilterRole: string[];
  angkatan: number | null;
  setAngkatan: Dispatch<SetStateAction<number | null>>;
  ubahFilter: (ubah: () => void) => void;
}

/** Pemilah status, role, dan angkatan. */
export default function BilahFilter({
  isAdmin,
  status,
  setStatus,
  role,
  setRole,
  opsiFilterRole,
  angkatan,
  setAngkatan,
  ubahFilter,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl">
      {/* Filter status hanya untuk pengelola: direktori mahasiswa selalu
          berisi akun aktif dan server mengabaikan filter ini bagi mereka. */}
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Status
          <select
            value={status}
            onChange={(e) => ubahFilter(() => setStatus(e.target.value))}
            className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        Role
        <select
          value={role}
          onChange={(e) => ubahFilter(() => setRole(e.target.value))}
          className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
        >
          <option value="ALL">Semua Role</option>
          {opsiFilterRole.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
      </label>

      {angkatan !== null && (
        <button
          type="button"
          onClick={() => ubahFilter(() => setAngkatan(null))}
          title={`Hapus filter angkatan ${angkatan}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold transition rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-900 dark:hover:bg-amber-900/60"
        >
          Angkatan {angkatan}
          <X className="w-3.5 h-3.5" />
          <span className="sr-only">Hapus filter angkatan</span>
        </button>
      )}
    </div>
  );
}
