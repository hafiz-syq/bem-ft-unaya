import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { Activity, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
  // null berarti peristiwa sistem (mis. penolakan permintaan dari origin web
  // yang tidak dikenal), bukan tindakan seorang pengguna.
  actor: {
    nim: string;
    role: string;
    profile: { nama: string } | null;
  } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const fetchLogs = async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/audit', { params: { page: currentPage, limit: 15 } });
      setLogs(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.message || 'Gagal memuat log aktivitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(page);
  }, [page]);

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Activity className="w-6 h-6 text-amber-400" />
            Log Aktivitas Sistem
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Pantau semua aktivitas perubahan data dan aksi penting di sistem.</p>
        </div>
      </div>

      {error && <div className="p-4 text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>}

      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <th className="p-4 font-medium">Waktu</th>
                <th className="p-4 font-medium">Aktor</th>
                <th className="p-4 font-medium">Aksi</th>
                <th className="p-4 font-medium">Deskripsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-400" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada aktivitas terekam.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-900 dark:text-gray-100">{log.actor?.profile?.nama || 'Sistem'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {log.actor ? `${log.actor.nim} • ${log.actor.role}` : 'Peristiwa otomatis'}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs font-bold uppercase border rounded text-amber-500 border-amber-100 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">{log.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Halaman {meta.page} dari {meta.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={meta.page === 1} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={meta.page === meta.totalPages} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}