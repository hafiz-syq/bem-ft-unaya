import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, X } from 'lucide-react';
import type { FormAdmin } from './data-mahasiswa';

interface Props {
  setAdminTerbuka: Dispatch<SetStateAction<boolean>>;
  formAdmin: FormAdmin;
  setFormAdmin: Dispatch<SetStateAction<FormAdmin>>;
  galatAdmin: string;
  menyimpanAdmin: boolean;
  simpanAdmin: (e: FormEvent) => void;
}

/** Modal tambah akun administrator (khusus SUPERADMIN). */
export default function ModalAdmin({
  setAdminTerbuka,
  formAdmin,
  setFormAdmin,
  galatAdmin,
  menyimpanAdmin,
  simpanAdmin,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Tambah administrator" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setAdminTerbuka(false)}>
      <form
        onSubmit={simpanAdmin}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <ShieldCheck className="w-5 h-5 text-purple-400" /> Tambah Akun Admin
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Administrator bisa mengelola mahasiswa, organisasi, dan konten. Hanya SUPERADMIN yang dapat membuat akun ini.
            </p>
          </div>
          <button type="button" onClick={() => setAdminTerbuka(false)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {galatAdmin && (
            <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatAdmin}
            </div>
          )}

          <div>
            <label htmlFor="admin-username" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input
              id="admin-username"
              type="text"
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9._-]{3,40}"
              placeholder="Contoh: admin.fakultas"
              value={formAdmin.nim}
              onChange={(e) => setFormAdmin((f) => ({ ...f, nim: e.target.value }))}
              className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai untuk login. Huruf, angka, titik, garis bawah, atau strip (3–40 karakter).</p>
          </div>

          <div>
            <label htmlFor="admin-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              id="admin-email"
              type="email"
              required
              placeholder="admin@domain.com"
              value={formAdmin.email}
              onChange={(e) => setFormAdmin((f) => ({ ...f, email: e.target.value }))}
              className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai untuk fitur lupa password. Harus unik.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password awal</label>
              <input
                id="admin-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={formAdmin.password}
                onChange={(e) => setFormAdmin((f) => ({ ...f, password: e.target.value }))}
                className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
              />
            </div>
            <div>
              <label htmlFor="admin-konfirmasi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ulangi password</label>
              <input
                id="admin-konfirmasi"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={formAdmin.konfirmasi}
                onChange={(e) => setFormAdmin((f) => ({ ...f, konfirmasi: e.target.value }))}
                className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Password minimal 8 karakter. Sampaikan password awal kepada admin tersebut; ia bisa menggantinya lewat halaman Profil.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setAdminTerbuka(false)}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={menyimpanAdmin}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {menyimpanAdmin && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan Admin
          </button>
        </div>
      </form>
    </div>
  );
}
