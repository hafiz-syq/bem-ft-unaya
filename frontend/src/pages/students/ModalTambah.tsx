import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { AlertTriangle, Loader2, UserPlus, X } from 'lucide-react';
import { PROGRAM_STUDI, type FormTambah } from './data-mahasiswa';

interface Props {
  setTambahTerbuka: Dispatch<SetStateAction<boolean>>;
  formTambah: FormTambah;
  setFormTambah: Dispatch<SetStateAction<FormTambah>>;
  galatTambah: string;
  menyimpanTambah: boolean;
  simpanTambah: (e: FormEvent) => void;
}

/** Modal tambah mahasiswa manual (satu per satu). */
export default function ModalTambah({
  setTambahTerbuka,
  formTambah,
  setFormTambah,
  galatTambah,
  menyimpanTambah,
  simpanTambah,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Tambah mahasiswa" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setTambahTerbuka(false)}>
      <form
        onSubmit={simpanTambah}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <UserPlus className="w-5 h-5 text-amber-400" /> Tambah Mahasiswa
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Akun dibuat satu per satu. Password awal sama dengan NIM dan wajib diganti saat login pertama.
            </p>
          </div>
          <button type="button" onClick={() => setTambahTerbuka(false)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {galatTambah && (
            <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatTambah}
            </div>
          )}

          <div>
            <label htmlFor="tambah-nim" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">NIM</label>
            <input
              id="tambah-nim"
              type="text"
              required
              inputMode="numeric"
              pattern="\d{8}[A-Za-z]?"
              placeholder="Contoh: 22140001"
              value={formTambah.nim}
              onChange={(e) => setFormTambah((f) => ({ ...f, nim: e.target.value }))}
              className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">8 digit angka, boleh diakhiri satu huruf.</p>
          </div>

          <div>
            <label htmlFor="tambah-nama" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
            <input
              id="tambah-nama"
              type="text"
              required
              value={formTambah.nama}
              onChange={(e) => setFormTambah((f) => ({ ...f, nama: e.target.value }))}
              className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
          </div>

          <div>
            <label htmlFor="tambah-prodi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Program Studi</label>
            <select
              id="tambah-prodi"
              value={formTambah.program_studi}
              onChange={(e) => setFormTambah((f) => ({ ...f, program_studi: e.target.value }))}
              className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            >
              {PROGRAM_STUDI.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tambah-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email (opsional)</label>
              <input
                id="tambah-email"
                type="email"
                value={formTambah.email}
                onChange={(e) => setFormTambah((f) => ({ ...f, email: e.target.value }))}
                className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
              />
            </div>
            <div>
              <label htmlFor="tambah-hp" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">No. HP/WA (opsional)</label>
              <input
                id="tambah-hp"
                type="tel"
                value={formTambah.no_hp}
                onChange={(e) => setFormTambah((f) => ({ ...f, no_hp: e.target.value }))}
                className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTambahTerbuka(false)}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={menyimpanTambah}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
          >
            {menyimpanTambah && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan Akun
          </button>
        </div>
      </form>
    </div>
  );
}
