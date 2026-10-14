import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

// Definisi tipe data agar TypeScript bahagia
interface Student {
  id: string;
  nim: string;
  isActive: boolean;
  profile: {
    nama: string;
    program_studi: string;
  };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  // Fungsi untuk mengambil data dari backend
  const fetchStudents = async (currentPage: number, currentSearch: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/students', {
        params: {
          page: currentPage,
          limit: 15, // Menampilkan 10 data per halaman
          search: currentSearch
        }
      });
      setStudents(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat data mahasiswa');
      } else {
        setError('Terjadi kesalahan yang tidak terduga');
      }
    } finally {
      setLoading(false);
    }
  };

  // Memicu fetch setiap kali nilai 'page' berubah
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudents(page, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]); 
  
  // Handler untuk kolom pencarian
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Kembali ke halaman 1 saat melakukan pencarian baru
    fetchStudents(1, search);
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      
      {/* Header Halaman & Form Pencarian */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Mahasiswa</h1>
          <p className="text-sm text-gray-500">
            Total {meta?.total || 0} mahasiswa terdaftar di sistem.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari NIM atau Nama..."
              className="block w-full py-2 pr-3 text-sm border border-gray-300 rounded-lg pl-9 focus:ring-amber-300 focus:border-amber-300"
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
      </div>

      {/* Pesan Error */}
      {error && (
        <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50">{error}</div>
      )}

      {/* Tabel Data Mahasiswa */}
      <div className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="p-4 font-medium">NIM</th>
                <th className="p-4 font-medium">Nama Mahasiswa</th>
                <th className="p-4 font-medium">Program Studi</th>
                <th className="p-4 font-medium text-center">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Tidak ada data mahasiswa ditemukan.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{student.nim}</td>
                    <td className="p-4 text-gray-700">{student.profile.nama}</td>
                    <td className="p-4 text-gray-600">{student.profile.program_studi}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Halaman {meta.page} dari {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.page === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page === meta.totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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