import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/axios';
import { Activity, Clock, Loader2, Trash2, ChevronDown, AlertTriangle, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, ROLE_SUPERADMIN } from '../lib/roles';

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

/** Jumlah log yang dimuat sekali tekan "Lihat lebih banyak". */
const PER_HALAMAN = 20;

export default function AuditLogs() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const isSuperadmin = user?.role === ROLE_SUPERADMIN;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menghapusMassal, setMenghapusMassal] = useState(false);

  const muatLog = useCallback(async (halamanDiminta: number, tambah: boolean) => {
    if (tambah) setMemuatLagi(true);
    else setLoading(true);
    setError('');
    try {
      const response = await api.get('/audit', {
        params: { page: halamanDiminta, limit: PER_HALAMAN },
      });
      const data = response.data.data as AuditLog[];
      setLogs((sebelumnya) => (tambah ? [...sebelumnya, ...data] : data));
      setMeta(response.data.meta);
      setHalaman(halamanDiminta);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat log aktivitas');
      }
    } finally {
      setLoading(false);
      setMemuatLagi(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muatLog(1, false);
  }, [muatLog]);

  const muatLagi = () => muatLog(halaman + 1, true);

  const hapusSatu = async (log: AuditLog) => {
    if (!window.confirm(`Hapus log "${log.action}" milik ${log.actor?.profile?.nama || 'Sistem'}?`)) return;
    setBusyId(log.id);
    setError('');
    setNotice('');
    try {
      const res = await api.delete(`/audit/${log.id}`);
      setNotice(res.data.message || 'Log dihapus.');
      setLogs((sebelumnya) => sebelumnya.filter((l) => l.id !== log.id));
      setMeta((m) => (m ? { ...m, total: Math.max(0, m.total - 1) } : m));
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.message || 'Gagal menghapus log.');
    } finally {
      setBusyId(null);
    }
  };

  const hapusMassal = async (semua: boolean) => {
    const teks = semua
      ? 'Hapus SELURUH log aktivitas? Tindakan ini tidak bisa dibatalkan.'
      : 'Hapus log yang lebih lama dari 30 hari? Log terbaru tetap disimpan.';
    if (!window.confirm(teks)) return;

    setMenghapusMassal(true);
    setError('');
    setNotice('');
    try {
      const res = await api.delete('/audit', { params: semua ? { semua: 'true' } : { hari: 30 } });
      setNotice(res.data.message);
      await muatLog(1, false);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.message || 'Gagal menghapus log.');
    } finally {
      setMenghapusMassal(false);
    }
  };

  const masihAda = Boolean(meta && logs.length < meta.total);

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Activity className="w-6 h-6 text-amber-400" />
            Log Aktivitas Sistem
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pantau semua aktivitas perubahan data dan aksi penting di sistem.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => hapusMassal(false)}
              disabled={menghapusMassal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
              title="Hapus log yang lebih lama dari 30 hari"
            >
              {menghapusMassal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Hapus log lama
            </button>

            {isSuperadmin && (
              <button
                type="button"
                onClick={() => hapusMassal(true)}
                disabled={menghapusMassal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50"
                title="Hapus seluruh log (khusus SUPERADMIN)"
              >
                <ShieldCheck className="w-4 h-4" />
                Hapus semua
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-4 text-sm font-bold text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/60">
          {notice}
        </div>
      )}

      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <th className="p-4 font-medium">Waktu</th>
                <th className="p-4 font-medium">Aktor</th>
                <th className="p-4 font-medium">Aksi</th>
                <th className="p-4 font-medium">Deskripsi</th>
                {isSuperadmin && <th className="p-4 font-medium text-center">Hapus</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={isSuperadmin ? 5 : 4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={isSuperadmin ? 5 : 4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Belum ada aktivitas terekam.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
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
                    {isSuperadmin && (
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => hapusSatu(log)}
                          disabled={busyId === log.id}
                          title="Hapus log ini"
                          aria-label={`Hapus log ${log.action}`}
                          className="inline-flex items-center justify-center p-2 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                        >
                          {busyId === log.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-800 sm:flex-row">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {logs.length} dari {meta?.total ?? 0} log.
          </p>

          {masihAda && (
            <button
              type="button"
              onClick={muatLagi}
              disabled={memuatLagi}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 dark:text-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
            >
              {memuatLagi ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              Lihat lebih banyak
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
