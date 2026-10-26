import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, ROLE_SUPERADMIN } from '../lib/roles';
import {
  AlertTriangle, CheckCircle, Loader2, RefreshCw, ShieldAlert, Trash2, Undo2, ChevronDown,
} from 'lucide-react';

interface LogKesalahan {
  id: string;
  message: string;
  stack: string | null;
  method: string;
  path: string;
  statusCode: number;
  userId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

type Filter = 'OPEN' | 'RESOLVED' | 'ALL';

export default function ErrorLogs() {
  const { user } = useAuth();
  const admin = isAdminRole(user?.role);

  const [data, setData] = useState<LogKesalahan[]>([]);
  const [meta, setMeta] = useState<{ terbuka: number; total: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const muat = useCallback(async (status: Filter) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/error-logs', { params: { status } });
      setData(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal memuat catatan kesalahan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat(filter);
  }, [filter, muat]);

  const ubahStatus = async (log: LogKesalahan) => {
    setBusyId(log.id);
    setError('');
    try {
      const res = await api.patch(`/error-logs/${log.id}`, { resolved: !log.resolvedAt });
      setNotice(res.data.message);
      await muat(filter);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal mengubah status.');
    } finally {
      setBusyId(null);
    }
  };

  const bersihkan = async () => {
    if (!window.confirm('Hapus semua catatan kesalahan yang sudah selesai?')) return;
    try {
      const res = await api.delete('/error-logs/resolved');
      setNotice(res.data.message);
      await muat(filter);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal membersihkan catatan.');
    }
  };

  if (!admin) {
    return (
      <div className="max-w-4xl p-6 mx-auto md:p-8">
        <div className="p-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900">
          Halaman pemantauan hanya tersedia untuk admin.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white border border-gray-100 shadow-sm md:flex-row md:items-center rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <ShieldAlert className="w-6 h-6 text-amber-400" /> Pemantauan Kesalahan
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kesalahan server yang tidak terduga, dikumpulkan agar bisa ditinjau tanpa membuka log platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => muat(filter)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
          </button>
          {user?.role === ROLE_SUPERADMIN && (
            <button type="button" onClick={bersihkan} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 dark:text-red-400 dark:bg-red-950/60">
              <Trash2 className="w-4 h-4" /> Bersihkan selesai
            </button>
          )}
        </div>
      </div>

      {meta && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">Belum selesai</p>
            <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">{meta.terbuka}</p>
          </div>
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 uppercase dark:text-gray-400">Total tercatat</p>
            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{meta.total}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'RESOLVED', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${filter === f ? 'bg-amber-400 text-white border-amber-400' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'}`}
          >
            {f === 'OPEN' ? 'Belum selesai' : f === 'RESOLVED' ? 'Selesai' : 'Semua'}
          </button>
        ))}
      </div>

      {error && <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>}
      {notice && <div className="p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">{notice}</div>}

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-8 h-8 mx-auto text-amber-400 animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Tidak ada kesalahan</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Server berjalan tanpa kegagalan tak terduga pada filter ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((log) => (
            <article key={log.id} className="p-5 bg-white border border-gray-200 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${log.resolvedAt ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {log.resolvedAt ? 'Selesai' : 'Belum selesai'}
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-300">{log.method} {log.path}</span>
                    <span className="text-xs text-gray-400">HTTP {log.statusCode}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900 dark:text-gray-100 break-words">{log.message}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
                    {log.userId ? ` • pengguna ${log.userId.slice(0, 8)}…` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => ubahStatus(log)}
                  disabled={busyId === log.id}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 ${log.resolvedAt ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60' : 'text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-950/60'}`}
                >
                  {busyId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : log.resolvedAt ? <><Undo2 className="w-3.5 h-3.5" /> Buka lagi</> : <><CheckCircle className="w-3.5 h-3.5" /> Tandai selesai</>}
                </button>
              </div>
              {log.stack && (
                <details className="mt-3">
                  <summary className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 cursor-pointer dark:text-gray-400">
                    <ChevronDown className="w-3.5 h-3.5" /> Lihat stack trace
                  </summary>
                  <pre className="p-3 mt-2 overflow-x-auto text-[11px] leading-relaxed text-gray-700 bg-gray-50 rounded-lg dark:bg-gray-800 dark:text-gray-300">{log.stack}</pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-4 h-4 shrink-0" /> Catatan ini hanya memuat pesan kesalahan, bukan kata sandi, token, atau isi formulir pengguna.
      </p>
    </div>
  );
}
