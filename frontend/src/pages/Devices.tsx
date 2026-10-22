import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Smartphone, ShieldCheck, Search, Loader2, RefreshCw, Check, X,
  Unlock, Clock, ChevronLeft, ChevronRight, Info, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { isAdminRole, ROLE_LABEL } from '../lib/roles';

interface PerangkatAkun {
  id: string;
  nim: string;
  nama: string | null;
  programStudi: string | null;
  role: string;
  isActive: boolean;
  terikat: boolean;
  perangkat: { label: string; sejak: string | null } | null;
  percobaan: { label: string; pada: string | null } | null;
  /** Jumlah perangkat yang boleh aktif bersamaan (1 = perilaku lama). */
  maxDevices: number;
  /** Perangkat yang sedang terdaftar (utama + tambahan). */
  jumlahPerangkat: number;
  perangkatTambahan: { id: string; label: string; sejak: string | null }[];
  dapatDikelola: boolean;
}

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
  maxDevices: number;
  dapatDikelola: boolean;
  perangkat: PerangkatTerdaftar[];
  percobaan: { label: string; pada: string | null } | null;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalHalaman: number;
  statistik: { total: number; terikat: number; menunggu: number; bebas: number };
}

type Mode = 'IZINKAN' | 'LEPAS' | 'TOLAK';

const tanggal = (nilai: string | null): string => {
  if (!nilai) return '-';
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function Devices() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = isAdminRole(user?.role);

  const [akun, setAkun] = useState<PerangkatAkun[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cari, setCari] = useState('');
  const [cariTerpakai, setCariTerpakai] = useState('');
  const [status, setStatus] = useState('SEMUA');
  const [halaman, setHalaman] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');
  const [aksi, setAksi] = useState('');

  // Panel riwayat perangkat satu akun.
  const [rincian, setRincian] = useState<RincianPerangkat | null>(null);
  const [memuatRincian, setMemuatRincian] = useState(false);
  const [galatRincian, setGalatRincian] = useState('');
  const [mencabut, setMencabut] = useState<string | null>(null);

  // Tunda pencarian sebentar supaya tidak memanggil API pada setiap ketukan.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCariTerpakai(cari.trim());
      setHalaman(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [cari]);

  const muat = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/devices', {
        params: { search: cariTerpakai || undefined, status, page: halaman, limit: 20 },
      });
      setAkun(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal memuat data perangkat.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setLoading(false);
    }
  }, [admin, cariTerpakai, status, halaman]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat();
  }, [muat]);

  useEffect(() => {
    if (!pesan) return;
    const timer = setTimeout(() => setPesan(''), 6000);
    return () => clearTimeout(timer);
  }, [pesan]);

  const ubahBatas = async (target: PerangkatAkun, nilai: number) => {
    if (nilai === target.maxDevices) return;
    if (!window.confirm(`Izinkan ${target.nama || target.nim} aktif di ${nilai} perangkat sekaligus?`)) return;

    setAksi(`${target.id}:BATAS`);
    setError('');
    setPesan('');
    try {
      const res = await api.patch(`/devices/${target.id}/batas`, { maxDevices: nilai });
      setPesan(res.data.message);
      await muat();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal mengubah batas perangkat.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setAksi('');
    }
  };

  const muatRincian = async (id: string) => {
    const res = await api.get(`/devices/${id}`);
    setRincian(res.data.data);
  };

  const bukaRincian = async (target: PerangkatAkun) => {
    // Tampilkan kerangka dulu supaya modal langsung terbuka tanpa menunggu.
    setRincian({
      id: target.id,
      nim: target.nim,
      nama: target.nama,
      role: target.role,
      isActive: target.isActive,
      maxDevices: target.maxDevices,
      dapatDikelola: target.dapatDikelola,
      perangkat: [],
      percobaan: target.percobaan,
    });
    setGalatRincian('');
    setMemuatRincian(true);
    try {
      await muatRincian(target.id);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setGalatRincian(err.response?.data?.message || 'Gagal memuat rincian perangkat.');
      } else {
        setGalatRincian('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setMemuatRincian(false);
    }
  };

  const putuskanSatu = async (perangkat: PerangkatTerdaftar) => {
    if (!rincian) return;
    const namaAkun = rincian.nama || rincian.nim;
    if (!window.confirm(`Putuskan perangkat "${perangkat.label}" dari ${namaAkun}? Perangkat ini akan keluar; perangkat lain tetap aktif.`)) return;

    setMencabut(perangkat.id);
    setGalatRincian('');
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
      await muatRincian(rincian.id);
      await muat();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setGalatRincian(err.response?.data?.message || 'Gagal memutus perangkat.');
      } else {
        setGalatRincian('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setMencabut(null);
    }
  };

  const jalankan = async (target: PerangkatAkun, mode: Mode) => {
    const konfirmasi: Record<Mode, string> = {
      IZINKAN: `Izinkan perangkat baru "${target.percobaan?.label ?? 'perangkat tidak dikenal'}" untuk ${target.nama || target.nim}? Perangkat lama akan otomatis keluar.`,
      LEPAS: `Lepas kunci perangkat ${target.nama || target.nim}? Akun bisa login dari perangkat mana pun dan sesi lama langsung berakhir.`,
      TOLAK: `Tolak percobaan login dari "${target.percobaan?.label ?? 'perangkat tidak dikenal'}"? Perangkat lama tetap berlaku.`,
    };

    if (!window.confirm(konfirmasi[mode])) return;

    setAksi(`${target.id}:${mode}`);
    setError('');
    setPesan('');
    try {
      const res = await api.post(`/devices/${target.id}/reset`, { mode });

      if (res.data?.perluLoginUlang) {
        // Admin mengubah perangkat akunnya sendiri: tokennya sudah tidak sah,
        // jadi langsung keluar agar tidak terjebak pada halaman yang gagal memuat.
        alert(res.data.message);
        await logout();
        navigate('/login', { replace: true });
        return;
      }

      setPesan(res.data.message || 'Perubahan berhasil disimpan.');
      await muat();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal mengubah kunci perangkat.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setAksi('');
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
                Menu Perangkat & Sesi hanya untuk ADMIN dan SUPERADMIN.
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
    <div className="max-w-5xl p-4 mx-auto space-y-5 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-gray-100">
            <Smartphone className="w-6 h-6 text-amber-500" /> Perangkat & Sesi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Akun aktif di satu perangkat secara bawaan. Untuk pengguna yang benar-benar butuh lebih dari satu (mis. HP + laptop), admin dapat menaikkan batas perangkat pada akun tersebut.
          </p>
        </div>
        <button
          type="button"
          onClick={muat}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 text-xs text-blue-800 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Bila pengguna mencoba login dari perangkat lain, percobaannya tercatat di bawah. Klik
          <span className="font-bold"> Izinkan perangkat baru</span> untuk memindahkan akun. Bila perangkat hanya rusak/hilang dan pengguna belum mencoba login,
          klik <span className="font-bold">Lepas kunci</span>; pengguna akan terikat kembali ke perangkat pertama yang dipakai setelahnya.
        </p>
        <p className="mt-1">
          Untuk mengeluarkan satu perangkat saja (mis. HP lama yang masih login), buka
          <span className="font-bold"> Rincian perangkat</span> pada kartu akun lalu tekan <span className="font-bold">Putuskan</span> di baris perangkat tersebut.
        </p>
      </div>

      {meta && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Terikat
            </p>
            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{meta.statistik.terikat}</p>
          </div>
          <div className={`p-4 border shadow-sm rounded-xl ${meta.statistik.menunggu > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60' : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800'}`}>
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4 text-amber-500" /> Menunggu
            </p>
            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{meta.statistik.menunggu}</p>
          </div>
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
              <Unlock className="w-4 h-4 text-gray-400" /> Bebas
            </p>
            <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{meta.statistik.bebas}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
          <input
            type="search"
            aria-label="Cari nama atau NIM"
            placeholder="Cari nama atau NIM…"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="w-full py-2.5 pl-9 pr-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg outline-none dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select
          aria-label="Saring status perangkat"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setHalaman(1); }}
          className="px-3 py-2.5 text-sm font-medium bg-white border border-gray-300 rounded-lg outline-none dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-amber-400"
        >
          <option value="SEMUA">Semua akun</option>
          <option value="TERIKAT">Sudah terikat perangkat</option>
          <option value="MENUNGGU">Ada percobaan baru</option>
          <option value="BEBAS">Belum terikat</option>
        </select>
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

      {loading ? (
        <div className="flex justify-center p-12" role="status" aria-live="polite">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="sr-only">Memuat data perangkat…</span>
        </div>
      ) : akun.length === 0 ? (
        <div className="p-10 text-center bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <Smartphone className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700" />
          <p className="mt-3 font-bold text-gray-700 dark:text-gray-300">Tidak ada akun yang cocok</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba kata kunci lain atau ubah penyaringan status.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {akun.map((a) => (
            <div key={a.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 text-sm font-black text-amber-700 rounded-full bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                    {(a.nama || a.nim).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate dark:text-gray-100">{a.nama || 'Tanpa nama'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.nim}{a.programStudi ? ` · ${a.programStudi}` : ''} · {ROLE_LABEL[a.role] || a.role}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!a.isActive && (
                    <span className="px-2.5 py-1 text-xs font-bold text-red-700 rounded-full bg-red-100 dark:bg-red-950/60 dark:text-red-300">Nonaktif</span>
                  )}
                  {a.terikat ? (
                    <span className="px-2.5 py-1 text-xs font-bold text-green-700 rounded-full bg-green-100 dark:bg-green-950/60 dark:text-green-300">Terikat</span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-bold text-gray-600 rounded-full bg-gray-100 dark:bg-gray-800 dark:text-gray-300">Belum terikat</span>
                  )}
                  {a.percobaan && (
                    <span className="px-2.5 py-1 text-xs font-bold text-amber-800 rounded-full bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200">Ada percobaan</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2">
                <div className="p-3 border border-gray-100 rounded-lg bg-gray-50 dark:bg-gray-800/60 dark:border-gray-800">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Perangkat terikat</p>
                  {a.perangkat ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100 break-words">{a.perangkat.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sejak {tanggal(a.perangkat.sejak)}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Login pertama akan otomatis mengunci perangkat.</p>
                  )}
                </div>

                <div className={`p-3 border rounded-lg ${a.percobaan ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60' : 'border-gray-100 bg-gray-50 dark:bg-gray-800/60 dark:border-gray-800'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Percobaan perangkat baru</p>
                  {a.percobaan ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100 break-words">{a.percobaan.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pada {tanggal(a.percobaan.pada)}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tidak ada percobaan dari perangkat lain.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-3 mt-3 text-sm border border-gray-100 rounded-lg bg-gray-50 dark:bg-gray-800/60 dark:border-gray-800">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Batas perangkat</p>
                  <p className="mt-0.5 font-bold text-gray-900 dark:text-gray-100">
                    {a.jumlahPerangkat} dari {a.maxDevices} perangkat terpakai
                  </p>
                  {a.perangkatTambahan.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-words">
                      Tambahan: {a.perangkatTambahan.map((p) => p.label).join(', ')}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                  Boleh aktif di
                  <select
                    value={a.maxDevices}
                    disabled={!a.dapatDikelola || Boolean(aksi)}
                    onChange={(e) => ubahBatas(a, Number(e.target.value))}
                    aria-label={`Batas perangkat ${a.nama || a.nim}`}
                    className="px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 disabled:opacity-50 focus:ring-2 focus:ring-amber-400"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} perangkat</option>
                    ))}
                  </select>
                  {aksi === `${a.id}:BATAS` && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </label>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {a.percobaan && (
                  <>
                    <button
                      type="button"
                      disabled={!a.dapatDikelola || Boolean(aksi)}
                      onClick={() => jalankan(a, 'IZINKAN')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {aksi === `${a.id}:IZINKAN` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Izinkan perangkat baru
                    </button>
                    <button
                      type="button"
                      disabled={!a.dapatDikelola || Boolean(aksi)}
                      onClick={() => jalankan(a, 'TOLAK')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {aksi === `${a.id}:TOLAK` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Tolak percobaan
                    </button>
                  </>
                )}
                {a.terikat && (
                  <button
                    type="button"
                    disabled={!a.dapatDikelola || Boolean(aksi)}
                    onClick={() => jalankan(a, 'LEPAS')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 dark:hover:bg-red-950/60"
                  >
                    {aksi === `${a.id}:LEPAS` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                    Lepas kunci
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => bukaRincian(a)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  title="Lihat dan putuskan perangkat satu per satu"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Rincian perangkat ({a.jumlahPerangkat})
                </button>
                {!a.dapatDikelola && (
                  <p className="self-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    Hanya SUPERADMIN yang dapat mengelola akun pengelola lain.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rincian && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Riwayat perangkat ${rincian.nama || rincian.nim}`}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
          onClick={() => setRincian(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                  <Smartphone className="w-5 h-5 text-amber-500" /> Riwayat Perangkat
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {rincian.nama || 'Tanpa nama'} • {rincian.nim} • {ROLE_LABEL[rincian.role] || rincian.role}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {rincian.perangkat.length} dari {rincian.maxDevices} perangkat terpakai
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRincian(null)}
                className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Tutup riwayat perangkat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {galatRincian && (
                <div className="p-3 text-sm font-bold text-red-700 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
                  {galatRincian}
                </div>
              )}

              {memuatRincian ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : rincian.perangkat.length === 0 ? (
                <div className="p-6 text-center border border-gray-100 rounded-lg bg-gray-50 dark:bg-gray-800/60 dark:border-gray-800">
                  <p className="font-bold text-gray-700 dark:text-gray-300">Belum ada perangkat terdaftar</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Perangkat akan terdaftar otomatis saat pengguna login.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {rincian.perangkat.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 p-3 text-sm border border-gray-100 rounded-lg bg-gray-50 dark:bg-gray-800/60 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-gray-100 break-words">
                          {p.label}
                          {p.utama && (
                            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Utama
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Sejak {tanggal(p.sejak)}
                          {p.terakhir ? ` • Terakhir dipakai ${tanggal(p.terakhir)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!rincian.dapatDikelola || Boolean(mencabut)}
                        onClick={() => putuskanSatu(p)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 shrink-0"
                      >
                        {mencabut === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        Putuskan
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {rincian.percobaan && (
                <div className="p-3 text-sm border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Percobaan perangkat baru</p>
                  <p className="mt-1 font-bold text-gray-900 dark:text-gray-100 break-words">{rincian.percobaan.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pada {tanggal(rincian.percobaan.pada)}</p>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Izinkan atau tolak percobaan ini lewat tombol di kartu akun.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Memutus satu perangkat hanya mengeluarkan sesi perangkat itu; perangkat lain tetap aktif. Untuk mengeluarkan
                semuanya sekaligus, gunakan <span className="font-bold">Lepas kunci</span> pada kartu akun.
              </p>
            </div>

            <div className="flex justify-end p-5 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setRincian(null)}
                className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {meta && meta.totalHalaman > 1 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-white border border-gray-100 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Halaman {meta.page} dari {meta.totalHalaman} · {meta.total} akun
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHalaman((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-100 rounded-lg disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setHalaman((p) => Math.min(meta.totalHalaman, p + 1))}
              disabled={meta.page >= meta.totalHalaman || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gray-100 rounded-lg disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
