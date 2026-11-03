import type { Dispatch, SetStateAction } from 'react';
import {
  CalendarClock, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2,
} from 'lucide-react';
import UserAvatar from '../../components/UserAvatar';
import { ROLE_LABEL } from '../../lib/roles';
import type { Meta, Student } from './data-mahasiswa';

interface Props {
  students: Student[];
  meta: Meta | null;
  loading: boolean;
  isAdmin: boolean;
  /** Id akun pemilik sesi; statusnya tidak bisa diubah dari tabel. */
  idAkunSendiri?: string;
  dipilih: Set<string>;
  semuaTerpilih: boolean;
  sedangProses: string | null;
  opsiRoleBaru: string[];
  toggleSemua: () => void;
  togglePilih: (id: string) => void;
  bukaProfil: (id: string) => void;
  ubahRole: (s: Student, roleBaru: string) => void;
  ubahStatus: (s: Student) => void;
  bolehUbahRole: (s: Student) => boolean;
  bolehHapus: (s: Student) => boolean;
  bukaKelola: (s: Student) => void;
  bukaEdit: (s: Student) => void;
  hapusStudent: (s: Student) => void;
  setPage: Dispatch<SetStateAction<number>>;
}

/** Tabel data mahasiswa berikut bilah halaman. */
export default function TabelMahasiswa({
  students,
  meta,
  loading,
  isAdmin,
  idAkunSendiri,
  dipilih,
  semuaTerpilih,
  sedangProses,
  opsiRoleBaru,
  toggleSemua,
  togglePilih,
  bukaProfil,
  ubahRole,
  ubahStatus,
  bolehUbahRole,
  bolehHapus,
  bukaKelola,
  bukaEdit,
  hapusStudent,
  setPage,
}: Props) {
  return (
    <div className="overflow-hidden bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
              {isAdmin && (
                <th className="w-10 p-4 font-medium">
                  <input
                    type="checkbox"
                    checked={semuaTerpilih}
                    onChange={toggleSemua}
                    aria-label="Pilih semua akun di halaman ini"
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                  />
                </th>
              )}
              <th className="p-4 font-medium">NIM</th>
              <th className="p-4 font-medium">Nama Mahasiswa</th>
              <th className="p-4 font-medium">Program Studi</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium text-center">Status Akun</th>
              {isAdmin && <th className="p-4 font-medium text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 5} className="p-8 text-center">
                  <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                  Tidak ada data mahasiswa ditemukan.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => bukaProfil(student.id)}
                  onKeyDown={(e) => {
                    // Hanya saat fokus ada di baris itu sendiri, bukan di
                    // tombol/select di dalamnya (Enter pada kontrol tetap
                    // menjalankan kontrol tersebut).
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      bukaProfil(student.id);
                    }
                  }}
                  tabIndex={0}
                  title={`Klik untuk melihat profil ${student.profile?.nama || student.nim}`}
                  className="cursor-pointer transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 dark:hover:bg-gray-800/60"
                >
                  {isAdmin && (
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={dipilih.has(student.id)}
                        onChange={() => togglePilih(student.id)}
                        aria-label={`Pilih ${student.profile?.nama || student.nim}`}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                      />
                    </td>
                  )}
                  <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{student.nim}</td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    <div className="flex items-center min-w-0 gap-3">
                      <UserAvatar
                        userId={student.id}
                        nama={student.profile?.nama || student.nim}
                        foto={student.foto ?? student.profile?.foto ?? null}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate dark:text-gray-100">{student.profile?.nama ?? '-'}</p>
                        {student.jabatan && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">
                            {student.jabatan}{student.organisasi ? ` — ${student.organisasi}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{student.profile?.program_studi ?? '-'}</td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>

                    {bolehUbahRole(student) ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={student.role}
                          disabled={sedangProses === student.id}
                          onChange={(e) => ubahRole(student, e.target.value)}
                          className="px-2 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300 disabled:opacity-50"
                        >
                          {(opsiRoleBaru.includes(student.role) ? opsiRoleBaru : [student.role, ...opsiRoleBaru]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                          ))}
                        </select>
                        {sedangProses === student.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                      </div>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">{ROLE_LABEL[student.role] ?? student.role}</span>
                    )}
                  </td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    {/* Pengunjung direktori (mahasiswa) hanya melihat status,
                        tidak bisa mengubahnya — tombol aktif hanya untuk pengelola. */}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => ubahStatus(student)}
                        disabled={sedangProses === student.id || student.id === idAkunSendiri}
                        title={student.id === idAkunSendiri ? 'Status akun sendiri tidak dapat diubah dari sini' : 'Klik untuk mengubah status'}
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full transition disabled:cursor-not-allowed ${student.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60'
                          }`}
                      >
                        {student.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold text-green-800 bg-green-100 rounded-full dark:bg-green-900/40 dark:text-green-300">
                        {student.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bukaKelola(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Kelola
                        </button>
                        <button
                          type="button"
                          onClick={() => bukaEdit(student)}
                          title={`Sunting data ${student.profile?.nama || student.nim}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        {bolehHapus(student) && (
                          <button
                            type="button"
                            onClick={() => hapusStudent(student)}
                            disabled={sedangProses === student.id}
                            title={`Hapus permanen ${student.profile?.nama || student.nim}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-600 rounded-lg bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/60 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sedangProses === student.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />} Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Halaman {meta.page} dari {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page === 1}
              className="p-2 text-gray-600 border border-gray-300 rounded-lg dark:text-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page === meta.totalPages}
              className="p-2 text-gray-600 border border-gray-300 rounded-lg dark:text-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
