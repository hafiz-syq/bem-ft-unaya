import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Smartphone, ShieldCheck, ShieldAlert, Check, X,
  Clock, Loader2, RefreshCw, Info, User,
} from 'lucide-react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { isAdminRole, ROLE_LABEL } from '../lib/roles';

interface PerangkatTerdaftar {
  /** "utama" untuk perangkat lama, atau id baris UserDevice. */
  id: string;
  utama: boolean;
  label: string;
  sejak: string | null;
  terakhir: string | null;
}

interface RincianPerangkat {
  id: string;
  nim: string;
  nama: string | null;
  role: string;
  isActive: boolean;
  foto: string | null;
  maxDevices: number;
  dapatDikelola: boolean;
  perangkat: PerangkatTerdaftar[];
  percobaan: { label: string; pada: string | null } | null;
}

const tanggal = (nilai: string | null): string => {
  if (!nilai) return '-';
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * Riwayat perangkat satu akun (ADMIN/SUPERADMIN).
 *
 * Halaman ini menampilkan setiap perangkat yang sedang terdaftar untuk satu
 * akun sehingga admin dapat memutus SATU perangkat saja tanpa melepas semua
 * sesi pengguna. Untuk mengeluarkan semuanya sekaligus tetap tersedia tombol
 * "Lepas kunci" di halaman Perangkat & Sesi.
 */
export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = isAdminRole(user?.role);

  const [rincian, setRincian] = useState<RincianPerangkat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');
  const [mencabut, setMencabut] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!admin || !id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/devices/${id}`);
      setRincian(res.data.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat riwayat perangkat.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setLoading(false);
    }
  }, [admin, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat();
  }, [muat]);

  useEffect(() => {
    if (!pesan) return;
    const timer = setTimeout(() => setPesan(''), 6000);
    return () => clearTimeout(timer);
  }, [pesan]);

  const putuskan = async (perangkat: PerangkatTerdaftar) => {
    if (!rincian) return;
    const namaAkun = rincian.nama || rincian.nim;
    if (!window.confirm(`Putuskan perangkat "${perangkat.label}" dari ${namaAkun}? Perangkat ini akan keluar; perangkat lain tetap aktif.`)) return;

    setMencabut(perangkat.id);
    setError('');
    setPesan('');
    try {
      const res = await api.delete(`/devices/${rincian.id}/perangkat/${perangkat.id}`);

      if (res.data?.perluLoginUlang) {
        alert(res.data.message);
        await logout();
        navigate('/login', { replace: true });
        return;
      }

      setPesan(res.data.message || 'Perangkat diputus.');
      await muat();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memutus perangkat.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setMencabut(null);
    }
  };

  if (!admin) {
    return (
      <div className="max-w-2xl p-6 mx-auto md:p-8">
        <div className="p-6 bg-white border border-red-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-red-900/60">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Akses ditolak</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Riwayat perangkat hanya untuk ADMIN dan SUPERADMIN.
              </p>
              <Link to="/dashboard" className="inline-block mt-4 font-bold text-amber-600 dark:text-amber-300 hover:underline">
                Kembali ke dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl p-4 mx-auto space-y-5 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/devices"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Perangkat & Sesi
          </Link>
          <h1 className="flex items-center gap-2 mt-2 text-2xl font-black text-gray-900 dark:text-gray-100">
            <Smartphone className="w-6 h-6 text-amber-500" /> Riwayat Perangkat
          </h1>
          {rincian ? (
            <div className="flex items-center gap-2 mt-2">
              <UserAvatar
                userId={rincian.id}
                nama={rincian.nama || rincian.nim}
                foto={rincian.foto}
                size="sm"
              />
              <p className="text-sm text-gray-600 break-words dark:text-gray-400">
                {rincian.nama || 'Tanpa nama'} • {rincian.nim} • {ROLE_LABEL[rincian.role] || rincian.role}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Perangkat yang terdaftar pada satu akun.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rincian && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${
              rincian.isActive
                ? 'text-green-700 bg-green-100 dark:bg-green-950/60 dark:text-green-300'
                : 'text-red-700 bg-red-100 dark:bg-red-950/60 dark:text-red-300'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {rincian.isActive ? 'Akun aktif' : 'Akun nonaktif'}
            </span>
          )}
          <button
            type="button"
            onClick={muat}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>
      </div>

      {pesan && (
        <div role="status" className="flex items-start gap-2 p-3 text-sm font-bold text-green-800 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900/60">
          <Check className="w-4 h-4 shrink-0 mt-0.5" /> {pesan}
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 text-sm font-bold text-red-700 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
          {error}
        </div>
      )}

      {loading && !rincian ? (
        <div className="flex justify-center p-12" role="status" aria-live="polite">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="sr-only">Memuat riwayat perangkat…</span>
        </div>
      ) : !rincian ? (
        <div className="p-10 text-center bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <Smartphone className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700" />
          <p className="mt-3 font-bold text-gray-700 dark:text-gray-300">Riwayat perangkat tidak dapat ditampilkan</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Akun mungkin sudah dihapus. Kembali ke daftar akun untuk memilih akun lain.
          </p>
          <Link to="/devices" className="inline-block mt-4 text-sm font-bold text-amber-600 dark:text-amber-300 hover:underline">
            Kembali ke Perangkat & Sesi
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                <Smartphone className="w-4 h-4 text-amber-500" /> Perangkat terpakai
              </p>
              <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">
                {rincian.perangkat.length} <span className="text-base font-bold text-gray-500 dark:text-gray-400">dari {rincian.maxDevices}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Batas diatur admin halaman Perangkat & Sesi.
              </p>
            </div>
            <div className={`p-4 border shadow-sm rounded-xl ${rincian.percobaan ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60' : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800'}`}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4 text-amber-500" /> Percobaan perangkat baru
              </p>
              {rincian.percobaan ? (
                <>
                  <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100 break-words">{rincian.percobaan.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pada {tanggal(rincian.percobaan.pada)}</p>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Izinkan atau tolak percobaan ini lewat tombol di halaman Perangkat & Sesi.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tidak ada percobaan dari perangkat lain.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Perangkat terdaftar</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tekan <span className="font-bold">Putuskan</span> pada satu baris untuk mengeluarkan perangkat itu saja.
              </p>
            </div>

            {rincian.perangkat.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-bold text-gray-700 dark:text-gray-300">Belum ada perangkat terdaftar</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Perangkat akan terdaftar otomatis saat pengguna login.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {rincian.perangkat.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-gray-100 break-words">
                          {p.label}
                          {p.utama && (
                            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Utama
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Sejak {tanggal(p.sejak)}
                          {p.terakhir ? ` • Terakhir dipakai ${tanggal(p.terakhir)}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!rincian.dapatDikelola || Boolean(mencabut)}
                      onClick={() => putuskan(p)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 dark:hover:bg-red-950/60 shrink-0"
                    >
                      {mencabut === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Putuskan
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {rincian.perangkat.length > 0 && !rincian.dapatDikelola && (
              <p className="px-4 py-3 text-xs font-medium text-gray-500 border-t border-gray-100 dark:text-gray-400 dark:border-gray-800">
                Hanya SUPERADMIN yang dapat memutus perangkat akun pengelola lain.
              </p>
            )}
          </div>

          {rincian.perangkat.length > 0 && (
            <div className="flex items-start gap-2 p-3 text-xs text-blue-800 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Memutus satu perangkat hanya mengakhiri sesi perangkat itu; perangkat lain tetap aktif. Bila perangkat
                terakhir diputus, akun akan terikat kembali ke perangkat pertama yang dipakai saat login berikutnya.
                Untuk mengeluarkan semua perangkat sekaligus, gunakan <span className="font-bold">Lepas kunci</span> di
                halaman Perangkat & Sesi.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <User className="w-4 h-4 shrink-0" /> ID akun: <span className="font-mono break-all">{rincian.id}</span>
          </div>
        </>
      )}
    </div>
  );
}
