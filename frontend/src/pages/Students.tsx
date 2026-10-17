import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/axios';
import { Search, Loader2, ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ASSIGNABLE_ROLES, ROLE_ADMIN, ROLE_LABEL } from '../lib/roles';

// Definisi tipe data agar TypeScript bahagia
interface Student {
  id: string;
  nim: string;
  role: string;
  isActive: boolean;
  jabatan: string | null;
  organisasi: string | null;
  profile: {
    nama: string;
    program_studi: string;
  } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT = 20;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
];

/**
 * Ambil pesan kesalahan dari server.
 * Ekspor CSV memakai responseType 'blob', sehingga balasan galat pun berupa Blob
 * dan harus dibaca sebagai teks dulu sebelum bisa diparse sebagai JSON.
 */
async function pesanKesalahan(err: unknown, bawaan: string): Promise<string> {
  if (!axios.isAxiosError(err)) return 'Terjadi kesalahan yang tidak terduga.';

  const data = err.response?.data;
  if (typeof data === 'string' || data instanceof Blob) {
    try {
      const teks = typeof data === 'string' ? data : await data.text();
      const pesan = (JSON.parse(teks) as { message?: string }).message;
      if (pesan) return pesan;
    } catch {
      // Balasan bukan JSON, pakai pesan bawaan.
    }
  } else if (data && typeof data.message === 'string') {
    return data.message;
  }

  return bawaan;
}

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLE_ADMIN;

  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  // `search` = isi kotak pencarian, `kataKunci` = yang benar-benar dipakai server.
  const [search, setSearch] = useState('');
  const [kataKunci, setKataKunci] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);

  // Fungsi untuk mengambil data dari backend
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/students', {
        params: {
          page,
          limit: LIMIT,
          search: kataKunci || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
        },
      });
      setStudents(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal memuat data mahasiswa'));
    } finally {
      setLoading(false);
    }
  }, [page, kataKunci, status, role]);

  // Memicu fetch setiap kali halaman, kata kunci, atau filter berubah
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudents();
  }, [fetchStudents]);

  // Handler untuk kolom pencarian
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Kembali ke halaman 1 saat melakukan pencarian baru
    setKataKunci(search.trim());
  };

  // Handler ekspor CSV: filter yang sedang aktif ikut dikirim ke server.
  const handleExportCsv = async () => {
    if (!window.confirm('Unduh seluruh data mahasiswa dalam bentuk CSV?')) return;

    setExporting(true);
    setNotice('');
    try {
      const res = await api.get('/students/export', {
        responseType: 'blob',
        params: {
          search: kataKunci || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
        },
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data-mahasiswa-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setNotice('Data mahasiswa berhasil diunduh sebagai CSV.');
    } catch (err) {
      alert(await pesanKesalahan(err, 'Gagal mengunduh CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const ubahFilter = (ubah: () => void) => {
    ubah();
    setPage(1);
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">

      {/* Header Halaman & Form Pencarian */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Mahasiswa</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total {meta?.total || 0} mahasiswa terdaftar di sistem.
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
                className="block w-full py-2 pr-3 text-sm text-gray-900 border border-gray-300 rounded-lg pl-9 bg-white dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500 focus:ring-amber-300 focus:border-amber-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
            >
              Cari
            </button>
          </form>

          {isAdmin && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 transition rounded-lg bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ekspor CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter Status & Role */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
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

        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Role
          <select
            value={role}
            onChange={(e) => ubahFilter(() => setRole(e.target.value))}
            className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
          >
            <option value="ALL">Semua Role</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Pesan Error / Notifikasi */}
      {error && (
        <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">
          <FileSpreadsheet className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Tabel Data Mahasiswa */}
      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                <th className="p-4 font-medium">NIM</th>
                <th className="p-4 font-medium">Nama Mahasiswa</th>
                <th className="p-4 font-medium">Program Studi</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium text-center">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data mahasiswa ditemukan.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{student.nim}</td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      {student.profile?.nama ?? '-'}
                      {student.jabatan && (
                        <span className="block text-xs text-gray-400 dark:text-gray-500">
                          {student.jabatan}{student.organisasi ? ` — ${student.organisasi}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{student.profile?.program_studi ?? '-'}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{ROLE_LABEL[student.role] ?? student.role}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {student.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {meta.page} dari {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page === 1}
                className="p-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page === meta.totalPages}
                className="p-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
