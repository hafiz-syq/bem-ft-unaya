import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { AlertTriangle, Loader2, Pencil, Save, X } from 'lucide-react';
import { PROGRAM_STUDI, type FormAkun, type Student } from './data-mahasiswa';

interface Props {
  edit: Student;
  setEdit: (s: Student | null) => void;
  formEdit: FormAkun;
  setFormEdit: Dispatch<SetStateAction<FormAkun>>;
  galatEdit: string;
  menyimpanEdit: boolean;
  simpanEdit: (e: FormEvent) => void;
}

/** Modal sunting data akun (admin & superadmin). */
export default function ModalSunting({
  edit,
  setEdit,
  formEdit,
  setFormEdit,
  galatEdit,
  menyimpanEdit,
  simpanEdit,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sunting data akun"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
      onClick={() => setEdit(null)}
    >
      <form
        onSubmit={simpanEdit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <Pencil className="w-5 h-5 text-amber-400" /> Sunting Data Akun
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {edit.profile?.nama ?? edit.nim} • {edit.nim}
            </p>
          </div>
          <button type="button" onClick={() => setEdit(null)} aria-label="Tutup" className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {galatEdit && (
            <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatEdit}
            </div>
          )}

          {edit.profile ? (
            <>
              <div>
                <label htmlFor="edit-nama" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                <input
                  id="edit-nama"
                  type="text"
                  required
                  maxLength={120}
                  value={formEdit.nama}
                  onChange={(e) => setFormEdit((f) => ({ ...f, nama: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>

              <div>
                <label htmlFor="edit-prodi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Program Studi</label>
                <select
                  id="edit-prodi"
                  value={formEdit.program_studi}
                  onChange={(e) => setFormEdit((f) => ({ ...f, program_studi: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                >
                  {(PROGRAM_STUDI as readonly string[]).includes(formEdit.program_studi)
                    ? PROGRAM_STUDI.map((p) => <option key={p} value={p}>{p}</option>)
                    : [formEdit.program_studi, ...PROGRAM_STUDI].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={formEdit.email}
                    onChange={(e) => setFormEdit((f) => ({ ...f, email: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
                <div>
                  <label htmlFor="edit-hp" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">No. HP/WA</label>
                  <input
                    id="edit-hp"
                    type="tel"
                    maxLength={30}
                    value={formEdit.no_hp}
                    onChange={(e) => setFormEdit((f) => ({ ...f, no_hp: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                Akun administrator tidak memiliki profil mahasiswa. Hanya email akun yang dapat disunting di sini.
              </div>
              <div>
                <label htmlFor="edit-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email Akun</label>
                <input
                  id="edit-email"
                  type="email"
                  value={formEdit.email}
                  onChange={(e) => setFormEdit((f) => ({ ...f, email: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>
            </>
          )}

          <div className="flex items-start gap-2 p-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              NIM tidak dapat diubah karena dipakai sebagai username login. Email dipakai untuk fitur lupa
              password; kosongkan bila akun tidak perlu punya email.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setEdit(null)}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={menyimpanEdit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
          >
            {menyimpanEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan</>}
          </button>
        </div>
      </form>
    </div>
  );
}
