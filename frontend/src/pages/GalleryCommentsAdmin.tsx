import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import { Check, Loader2, MessageSquare, Trash2, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { ROLE_LABEL } from '../lib/roles';
import UserAvatar from '../components/UserAvatar';

interface KomentarGaleri {
  id: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  penulis: string;
  role: string;
  foto: string | null;
  /** ID akun penulis; null untuk komentar tamu. */
  userId?: string | null;
  // Hanya terisi untuk komentar tamu; dipakai pengurus menilai spam.
  ip: string | null;
  perangkat: string | null;
  galeri: { id: string; title: string; url: string };
}

/** Ringkasan user-agent agar mudah dibaca tanpa menampilkan string panjang. */
const ringkasPerangkat = (userAgent: string | null): string | null => {
  if (!userAgent) return null;

  const browser = /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
      : /Chrome\//.test(userAgent) ? 'Chrome'
        : /Firefox\//.test(userAgent) ? 'Firefox'
          : /Safari\//.test(userAgent) ? 'Safari'
            : null;

  const sistem = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
      : /Windows/.test(userAgent) ? 'Windows'
        : /Mac OS X/.test(userAgent) ? 'macOS'
          : /Linux/.test(userAgent) ? 'Linux'
            : null;

  if (browser && sistem) return `${browser} di ${sistem}`;
  return browser || sistem || userAgent.slice(0, 60);
};

interface Meta {
  total: number;
  menunggu: number;
  disetujui: number;
  ditolak: number;
}

const TABS = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Tayang' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'ALL', label: 'Semua' },
];

/**
 * Moderasi komentar galeri.
 * Komentar baru masuk berstatus PENDING, jadi halaman ini yang menentukan
 * apakah sebuah komentar layak tayang di halaman Galeri publik.
 */
export default function GalleryCommentsAdmin() {
  const [komentar, setKomentar] = useState<KomentarGaleri[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sedangProses, setSedangProses] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/cms/gallery-comments', { params: { status } });
      setKomentar(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal memuat komentar galeri.'
          : 'Gagal memuat komentar galeri.'
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat();
  }, [muat]);

  // Berapa kali satu alamat IP muncul di daftar ini — sinyal cepat untuk
  // mengenali satu pengunjung yang membanjiri antrean moderasi.
  const jumlahPerIp = komentar.reduce<Record<string, number>>((akumulasi, item) => {
    if (item.ip) akumulasi[item.ip] = (akumulasi[item.ip] ?? 0) + 1;
    return akumulasi;
  }, {});

  const ubahStatus = async (id: string, baru: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    setSedangProses(id);
    setError('');
    try {
      await api.patch(`/cms/gallery-comments/${id}/status`, { status: baru });
      await muat();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal mengubah status komentar.'
          : 'Gagal mengubah status komentar.'
      );
    } finally {
      setSedangProses(null);
    }
  };

  const hapus = async (id: string) => {
    if (!window.confirm('Hapus komentar ini secara permanen?')) return;
    setSedangProses(id);
    try {
      await api.delete(`/cms/gallery-comments/${id}`);
      await muat();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Gagal menghapus komentar.'
          : 'Gagal menghapus komentar.'
      );
    } finally {
      setSedangProses(null);
    }
  };

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <MessageSquare className="w-6 h-6 text-amber-400" /> Komentar Galeri
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Setujui atau tolak komentar pengunjung pada dokumentasi galeri.
          </p>
        </div>
        <Link
          to="/gallery"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg text-amber-400 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-100 dark:hover:bg-amber-200"
        >
          <ImageIcon className="w-4 h-4" /> Lihat Halaman Galeri
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', nilai: meta?.total ?? 0 },
          { label: 'Menunggu', nilai: meta?.menunggu ?? 0 },
          { label: 'Tayang', nilai: meta?.disetujui ?? 0 },
          { label: 'Ditolak', nilai: meta?.ditolak ?? 0 },
        ].map((item) => (
          <div key={item.label} className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{item.nilai}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${
              status === tab.value
                ? 'bg-amber-400 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : komentar.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800">
          Belum ada komentar pada kategori ini.
        </div>
      ) : (
        <div className="space-y-3">
          {komentar.map((k) => (
            <article
              key={k.id}
              className="p-4 bg-white border border-gray-200 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="hidden w-20 h-20 overflow-hidden bg-gray-100 rounded-lg shrink-0 dark:bg-gray-800 sm:block">
                  <img src={assetUrl(k.galeri.url)} alt={k.galeri.title} className="object-cover w-full h-full" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserAvatar
                      userId={k.userId}
                      nama={k.penulis}
                      foto={k.foto}
                      size="xs"
                    />
                    <p className="font-bold text-gray-900 dark:text-gray-100">{k.penulis}</p>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {ROLE_LABEL[k.role] ?? k.role}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(k.createdAt).toLocaleString('id-ID')}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        k.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : k.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                      }`}
                    >
                      {k.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-700 break-words whitespace-pre-line dark:text-gray-300">{k.content}</p>

                  {k.role === 'TAMU' && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                        Asal: {k.ip || 'tidak tercatat'}
                      </span>
                      {k.perangkat && (
                        <span
                          title={k.perangkat}
                          className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800"
                        >
                          Perangkat: {ringkasPerangkat(k.perangkat)}
                        </span>
                      )}
                      {k.ip && jumlahPerIp[k.ip] > 1 && (
                        <span className="px-2 py-0.5 font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {jumlahPerIp[k.ip]} komentar dari IP ini
                        </span>
                      )}
                    </div>
                  )}

                  <Link
                    to="/gallery"
                    className="inline-block mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-300"
                  >
                    Pada galeri: {k.galeri.title}
                  </Link>
                </div>

                <div className="flex gap-2 sm:flex-col">
                  {k.status !== 'APPROVED' && (
                    <button
                      onClick={() => ubahStatus(k.id, 'APPROVED')}
                      disabled={sedangProses === k.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Setujui
                    </button>
                  )}
                  {k.status !== 'REJECTED' && (
                    <button
                      onClick={() => ubahStatus(k.id, 'REJECTED')}
                      disabled={sedangProses === k.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-gray-500 hover:bg-gray-600 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Tolak
                    </button>
                  )}
                  <button
                    onClick={() => hapus(k.id)}
                    disabled={sedangProses === k.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 rounded-lg bg-red-50 hover:bg-red-100 dark:text-red-300 dark:bg-red-950/60 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
