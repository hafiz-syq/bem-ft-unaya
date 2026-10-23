import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { isStaff, isAdminRole, ROLE_LABEL } from '../lib/roles';
import axios from 'axios';
import {
  MessageSquare, Search, Loader2, Check, X, CornerDownRight, Send, Info, UserCircle, Trash2
} from 'lucide-react';

interface Balasan {
  id: string;
  content: string;
  createdAt: string;
  penulis: string;
  role: string;
  /** Foto profil penulis balasan; null bila belum punya foto (tampil inisial). */
  foto?: string | null;
  /** ID akun penulis; null untuk data lama sehingga profil tidak bisa dibuka. */
  userId?: string | null;
}

interface Komentar {
  id: string;
  nama: string;
  asal_kampus: string;
  email?: string;
  no_hp?: string;
  content: string;
  status?: string;
  createdAt: string;
  moderatedAt?: string | null;
  ditinjauOleh?: string | null;
  balasan: Balasan[];
}

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu tinjauan',
  APPROVED: 'Tayang',
  REJECTED: 'Ditolak',
};

const STATUS_GAYA: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  APPROVED: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  REJECTED: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

const tanggal = (nilai: string) =>
  new Date(nilai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Buku tamu / suara publik.
 *
 * Dua wajah dalam satu halaman:
 * - Pengurus & admin: meninjau (setujui/tolak) dan membalas setiap pesan.
 * - Mahasiswa: hanya membaca pesan yang sudah tayang beserta balasan resminya;
 *   server tidak pernah mengirim data kontak pengirim ke peran ini.
 */
export default function PublicComments() {
  const { user } = useAuth();
  const staf = isStaff(user?.role);

  const [komentar, setKomentar] = useState<Komentar[]>([]);
  const [jumlah, setJumlah] = useState<{ total: number; menunggu: number; disetujui: number; ditolak: number } | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftBalasan, setDraftBalasan] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const muat = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    setError('');
    try {
      if (staf) {
        const res = await api.get('/public-comments/manage', { params: { status } });
        setKomentar(res.data.data);
        setJumlah(res.data.meta);
      } else {
        const res = await api.get('/public-comments');
        setKomentar(res.data.data);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat buku tamu.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setLoading(false);
    }
  }, [staf]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat(filter);
  }, [filter, muat]);

  const ubahStatus = async (k: Komentar, status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    const aksi = status === 'APPROVED' ? 'menyetujui' : status === 'REJECTED' ? 'menolak' : 'mengembalikan ke antrean';
    if (!window.confirm(`Yakin ingin ${aksi} pesan dari ${k.nama}?`)) return;

    setBusyId(k.id);
    setNotice('');
    try {
      const res = await api.patch(`/public-comments/manage/${k.id}/status`, { status });
      setNotice(res.data.message);
      muat(filter);
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal mengubah status pesan.');
      else alert('Terjadi kesalahan.');
    } finally {
      setBusyId(null);
    }
  };

  const hapusPesan = async (k: Komentar) => {
    const yakin = window.confirm(
      `Yakin ingin menghapus permanen pesan dari ${k.nama}? Pesan beserta seluruh balasannya tidak dapat dipulihkan kembali.`
    );
    if (!yakin) return;

    setBusyId(k.id);
    setNotice('');
    try {
      const res = await api.delete(`/public-comments/manage/${k.id}`);
      setNotice(res.data.message);
      muat(filter);
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal menghapus pesan.');
      else alert('Terjadi kesalahan.');
    } finally {
      setBusyId(null);
    }
  };

  const kirimBalasan = async (k: Komentar) => {
    const isi = (draftBalasan[k.id] || '').trim();
    if (isi.length < 2) {
      alert('Isi balasan minimal 2 karakter.');
      return;
    }

    setBusyId(k.id);
    setNotice('');
    try {
      const res = await api.post(`/public-comments/manage/${k.id}/replies`, { content: isi });
      setNotice(res.data.message);
      setDraftBalasan((draf) => ({ ...draf, [k.id]: '' }));
      muat(filter);
    } catch (err) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.message || 'Gagal mengirim balasan.');
      else alert('Terjadi kesalahan.');
    } finally {
      setBusyId(null);
    }
  };

  const kataKunci = search.toLowerCase();
  const terlihat = komentar.filter(
    (k) =>
      !kataKunci ||
      k.nama.toLowerCase().includes(kataKunci) ||
      k.asal_kampus.toLowerCase().includes(kataKunci) ||
      k.content.toLowerCase().includes(kataKunci)
  );

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm md:flex-row md:items-center rounded-xl">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <MessageSquare className="w-6 h-6 text-amber-500" /> Buku Tamu / Suara Publik
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {staf
              ? 'Tinjau pesan dari masyarakat, lalu balas sebagai perwakilan organisasi.'
              : 'Pesan dari masyarakat yang sudah tayang beserta balasan resmi pengurus.'}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute w-4 h-4 text-gray-400 dark:text-gray-500 left-3 top-3" />
          <input
            type="text"
            placeholder="Cari nama, kampus, atau isi pesan..."
            className="w-full py-2 pr-4 border rounded-lg outline-none md:w-72 pl-9 focus:ring-2 focus:ring-amber-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Ringkasan moderasi, hanya untuk staf */}
      {staf && jumlah && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total pesan', nilai: jumlah.total, warna: 'text-gray-900 dark:text-gray-100' },
            { label: 'Menunggu tinjauan', nilai: jumlah.menunggu, warna: 'text-amber-600 dark:text-amber-300' },
            { label: 'Tayang', nilai: jumlah.disetujui, warna: 'text-green-600 dark:text-green-400' },
            { label: 'Ditolak', nilai: jumlah.ditolak, warna: 'text-red-600 dark:text-red-400' },
          ].map((kartu) => (
            <div key={kartu.label} className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
              <p className="text-xs font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">{kartu.label}</p>
              <p className={`mt-1 text-2xl font-black ${kartu.warna}`}>{kartu.nilai}</p>
            </div>
          ))}
        </div>
      )}

      {staf && (
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${
                filter === s
                  ? 'bg-amber-400 text-white border-amber-400'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {s === 'ALL' ? 'Semua' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="p-4 text-sm font-bold text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/60">
          {notice}
        </div>
      )}
      {error && <div className="p-4 text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>}

      {!staf && (
        <div className="flex items-start gap-3 p-4 text-sm text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/60">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Hanya pengurus dan admin yang dapat membalas pesan di buku tamu. Balasan resmi
            organisasi tampil di bawah setiap pesan.
          </p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
        </div>
      ) : terlihat.length === 0 ? (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Belum ada pesan</p>
          <p>{staf ? 'Pesan baru dari halaman depan akan muncul di sini.' : 'Belum ada pesan yang tayang.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {terlihat.map((k) => (
            <div key={k.id} className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 text-xs font-bold text-white rounded-full shrink-0 bg-amber-400">
                    {k.nama.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{k.nama}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {k.asal_kampus} · {tanggal(k.createdAt)}
                    </p>
                    {staf && (k.email || k.no_hp) && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Kontak: {k.email} {k.no_hp ? `· ${k.no_hp}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {staf && k.status && (
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${STATUS_GAYA[k.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                      {STATUS_LABEL[k.status] || k.status}
                    </span>
                  )}
                  {staf && (
                    <>
                      {k.status !== 'APPROVED' && (
                        <button
                          onClick={() => ubahStatus(k, 'APPROVED')}
                          disabled={busyId === k.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-300 transition rounded-lg bg-green-50 dark:bg-green-950/60 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                        >
                          {busyId === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Setujui</>}
                        </button>
                      )}
                      {k.status !== 'REJECTED' && (
                        <button
                          onClick={() => ubahStatus(k, 'REJECTED')}
                          disabled={busyId === k.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 transition rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Tolak
                        </button>
                      )}
                      {/* Hapus permanen: khusus admin/superadmin (penjaga peran
                          juga ada di backend). Pengurus hanya bisa menolak. */}
                      {isAdminRole(user?.role) && (
                        <button
                          onClick={() => hapusPesan(k)}
                          disabled={busyId === k.id}
                          title="Hapus permanen pesan beserta balasannya"
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 transition border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 disabled:opacity-50"
                        >
                          {busyId === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Hapus</>}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="px-5 pb-4">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">{k.content}</p>
                {staf && k.moderatedAt && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Ditinjau {tanggal(k.moderatedAt)}
                    {k.ditinjauOleh ? ` oleh ${k.ditinjauOleh}` : ''}
                  </p>
                )}
              </div>

              {/* Utas balasan resmi */}
              {k.balasan.length > 0 && (
                <div className="px-5 pb-4 space-y-3">
                  {k.balasan.map((b) => (
                    <div key={b.id} className="flex gap-3 pl-4 border-l-2 border-amber-200 dark:border-amber-800">
                      <CornerDownRight className="w-4 h-4 mt-1 text-amber-400 shrink-0" />
                      <UserAvatar
                        userId={b.userId}
                        nama={b.penulis}
                        foto={b.foto ?? null}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                          {b.penulis}
                          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                            {ROLE_LABEL[b.role] || b.role} · {tanggal(b.createdAt)}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{b.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Kolom balasan, hanya untuk staf */}
              {staf && (
                <div className="flex flex-col gap-2 p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 sm:flex-row">
                  <div className="relative flex-1">
                    <UserCircle className="absolute w-4 h-4 text-gray-400 dark:text-gray-500 left-3 top-3" />
                    <input
                      type="text"
                      placeholder={`Balas sebagai ${ROLE_LABEL[user?.role || ''] || user?.role || 'staf'}...`}
                      className="w-full p-2 pr-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg outline-none pl-9 focus:ring-2 focus:ring-amber-300"
                      value={draftBalasan[k.id] || ''}
                      onChange={(e) => setDraftBalasan({ ...draftBalasan, [k.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') kirimBalasan(k);
                      }}
                    />
                  </div>
                  <button
                    onClick={() => kirimBalasan(k)}
                    disabled={busyId === k.id}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
                  >
                    {busyId === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Balas</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
