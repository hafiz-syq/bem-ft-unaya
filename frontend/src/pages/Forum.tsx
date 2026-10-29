import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessagesSquare, Plus, Loader2, Send, Lock, Unlock, Trash2, X, Users,
  MessageCircle, RefreshCw, AlertTriangle, Filter, Check,
} from 'lucide-react';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import { usePresence } from '../contexts/PresenceContext';
import UserAvatar from '../components/UserAvatar';
import { ROLE_LABEL } from '../lib/roles';

interface Ruang {
  id: string;
  nama: string;
  deskripsi: string | null;
  isOpen: boolean;
  jumlahPesan: number;
  pesanTerakhir: { isi: string; pada: string } | null;
}

interface Pesan {
  id: string;
  content: string;
  createdAt: string;
  penulis: { id: string; nim: string; role: string; nama: string; foto: string | null };
}

interface DetailRuang {
  id: string;
  nama: string;
  deskripsi: string | null;
  isOpen: boolean;
  bolehKelola: boolean;
}

// Polling cepat: pesan tiap 2,5 detik agar obrolan terasa live tanpa refresh,
// daftar ruang tiap 8 detik (lebih ringan karena hanya beberapa baris).
const JEDA_PESAN = 2_500;
const JEDA_RUANG = 8_000;

// Tiap puluhan ketukan, ambil pesan secara penuh untuk menyelaraskan kembali
// bila ada pesan yang dihapus pengguna lain (polling delta tidak tahu soal hapus).
const JEDA_SINKRONISASI = 10;

const jam = (nilai: string): string => {
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const tanggalPendek = (nilai: string): string => {
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

/** Pesan galat dari server, tanpa memakai tipe `any` pada blok catch. */
const pesanGalat = (err: unknown, cadangan: string): string => {
  const pesan = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return pesan || cadangan;
};

/**
 * Forum diskusi komunitas.
 *
 * Ruang dibuat oleh pengurus BEM/DPM atau admin; semua akun yang login dapat
 * membaca dan mengirim pesan. Pesan disegarkan berkala lewat polling delta
 * (bukan WebSocket) agar tetap berjalan di hosting serverless tanpa server
 * realtime tambahan, tapi cukup cepat untuk terasa live tanpa refresh manual.
 */
export default function Forum() {
  const { user } = useAuth();
  const { online } = usePresence();

  const [ruang, setRuang] = useState<Ruang[]>([]);
  const [bolehMembuat, setBolehMembuat] = useState(false);
  const [forumTerbuka, setForumTerbuka] = useState(false);
  const [memuatRuang, setMemuatRuang] = useState(true);
  const [galat, setGalat] = useState('');
  const [notice, setNotice] = useState('');

  const [aktifId, setAktifId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRuang | null>(null);
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [memuatPesan, setMemuatPesan] = useState(false);
  const [isi, setIsi] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [sedangProses, setSedangProses] = useState<string | null>(null);

  const [modalBuat, setModalBuat] = useState(false);
  const [formBuat, setFormBuat] = useState({ nama: '', deskripsi: '' });
  const [galatBuat, setGalatBuat] = useState('');
  const [menyimpanBuat, setMenyimpanBuat] = useState(false);

  // Filter kata forum (pengelola forum).
  const [modalFilter, setModalFilter] = useState(false);
  const [kataFilter, setKataFilter] = useState('');
  const [memuatFilter, setMemuatFilter] = useState(false);
  const [menyimpanFilter, setMenyimpanFilter] = useState(false);
  const [galatFilter, setGalatFilter] = useState('');

  const ujungPesan = useRef<HTMLDivElement>(null);
  // Nomor urut permintaan terakhir. Jawaban yang datang terlambat (pengguna
  // sudah pindah ruang atau ada polling yang lebih baru) dibuang supaya pesan
  // ruang A tidak pernah muncul di daftar ruang B.
  const urutanPermintaan = useRef(0);
  // Salinan daftar pesan agar polling delta selalu tahu id pesan terakhir
  // tanpa membuat fungsi callback basi (usang) pada interval.
  const pesanRef = useRef<Pesan[]>([]);
  useEffect(() => {
    pesanRef.current = pesan;
  }, [pesan]);
  const ketukanPolling = useRef(0);

  const ambilRuang = useCallback(async () => {
    try {
      const res = await api.get('/chat/rooms');
      const daftar: Ruang[] = res.data?.data ?? [];
      const terbuka = Boolean(res.data?.meta?.forumTerbuka);
      setRuang(daftar);
      setBolehMembuat(Boolean(res.data?.meta?.bolehMembuatRuang));
      setForumTerbuka(terbuka);
      setGalat('');

      if (!terbuka) {
        // Forum ditutup: kosongkan ruang aktif agar riwayat lama tidak tetap
        // terlihat di layar setelah pengurus menutup forum.
        setAktifId(null);
        setDetail(null);
        setPesan([]);
      } else {
        // Pertahankan ruang yang sedang dibuka bila masih ada; jika tidak,
        // pilih ruang pertama agar forum langsung bisa dibaca.
        setAktifId((sebelumnya) =>
          sebelumnya && daftar.some((r) => r.id === sebelumnya) ? sebelumnya : daftar[0]?.id ?? null
        );
      }
    } catch {
      setGalat('Daftar ruang forum gagal dimuat. Coba muat ulang halaman.');
    } finally {
      setMemuatRuang(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ambilRuang();
    const jadwal = window.setInterval(() => {
      if (!document.hidden) void ambilRuang();
    }, JEDA_RUANG);
    return () => window.clearInterval(jadwal);
  }, [ambilRuang]);

  const ambilPesan = useCallback(async (id: string, tampilkanMemuat: boolean, penuh = false) => {
    // Mode delta: hanya minta pesan yang lebih baru dari yang terakhir terlihat.
    const ujung = !tampilkanMemuat && !penuh ? pesanRef.current[pesanRef.current.length - 1]?.id : undefined;

    if (tampilkanMemuat) setMemuatPesan(true);

    // Jawaban yang datang terlambat (pengguna sudah pindah ruang atau ada
    // permintaan yang lebih baru) tidak boleh menimpa isi ruang yang dibuka.
    const nomor = ++urutanPermintaan.current;
    const masihAktif = () => urutanPermintaan.current === nomor;

    try {
      const res = await api.get(`/chat/rooms/${id}/messages`, {
        params: ujung ? { after: ujung } : undefined,
      });
      if (!masihAktif()) return;

      const hasil: Pesan[] = res.data?.data ?? [];

      setPesan((sebelum) => {
        if (!ujung) return hasil;
        // Saring duplikat: batas delta memakai `>=`, jadi pesan terakhir yang
        // sudah terlihat bisa ikut terkirim lagi.
        const sudahAda = new Set(sebelum.map((p) => p.id));
        return [...sebelum, ...hasil.filter((p) => !sudahAda.has(p.id))];
      });
      setDetail(res.data?.ruang ?? null);
      setGalat('');
    } catch {
      if (tampilkanMemuat && masihAktif()) setGalat('Pesan ruang ini gagal dimuat.');
    } finally {
      // Permintaan terbaru selalu menutup indikator muat, termasuk polling
      // delta yang menggantikan muat penuh di jaringan lambat. Bila hanya
      // `tampilkanMemuat` yang boleh menutupnya, indikator bisa berputar
      // selamanya ketika muat penuh kalah cepat oleh polling berikutnya.
      if (masihAktif()) setMemuatPesan(false);
    }
  }, []);

  useEffect(() => {
    // Kosongkan daftar ruang sebelumnya sebelum memuat ruang baru. Tanpa ini,
    // polling delta yang berjalan saat muat penuh masih di jalan akan memakai
    // id pesan ruang lama sebagai batas `after` dan mencampur pesan dua ruang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPesan([]);
    setDetail(null);
    pesanRef.current = [];

    if (!aktifId) {
      // Batalkan permintaan yang masih berjalan agar pesan ruang lama tidak
      // muncul lagi setelah daftar dikosongkan.
      urutanPermintaan.current += 1;
      return;
    }
    void ambilPesan(aktifId, true);
    const jadwal = window.setInterval(() => {
      // Tab sedang disembunyikan: jangan buang permintaan, nanti disusul saat
      // tab aktif kembali lewat listener visibilitychange di bawah.
      if (document.hidden) return;
      ketukanPolling.current += 1;
      const sinkronPenuh = ketukanPolling.current % JEDA_SINKRONISASI === 0;
      void ambilPesan(aktifId, false, sinkronPenuh);
    }, JEDA_PESAN);
    const saatTampil = () => {
      if (!document.hidden) void ambilPesan(aktifId, false, true);
    };
    document.addEventListener('visibilitychange', saatTampil);
    return () => {
      window.clearInterval(jadwal);
      document.removeEventListener('visibilitychange', saatTampil);
    };
  }, [aktifId, ambilPesan]);

  // Gulir ke pesan terbaru setiap daftar pesan berubah.
  useEffect(() => {
    ujungPesan.current?.scrollIntoView({ block: 'end' });
  }, [pesan.length, aktifId]);

  const bukaFilter = async () => {
    setModalFilter(true);
    setGalatFilter('');
    setMemuatFilter(true);
    try {
      const res = await api.get('/chat/filter');
      const daftar: string[] = res.data?.data ?? [];
      setKataFilter(daftar.join('\n'));
    } catch (err: unknown) {
      setGalatFilter(pesanGalat(err, 'Filter kata gagal dimuat.'));
    } finally {
      setMemuatFilter(false);
    }
  };

  const simpanFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalatFilter('');
    const daftar = Array.from(
      new Set(
        kataFilter
          .split(/[\n,;]+/)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 200)
      )
    );

    setMenyimpanFilter(true);
    try {
      const res = await api.put('/chat/filter', { kata: daftar });
      setModalFilter(false);
      setNotice(res.data?.message || 'Filter kata disimpan.');
    } catch (err: unknown) {
      setGalatFilter(pesanGalat(err, 'Filter kata gagal disimpan.'));
    } finally {
      setMenyimpanFilter(false);
    }
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    const teks = isi.trim();
    if (!teks || !aktifId || mengirim) return;

    setMengirim(true);
    setGalat('');
    try {
      const res = await api.post(`/chat/rooms/${aktifId}/messages`, { isi: teks });
      setIsi('');
      // Tambahkan pesan yang baru dikirim langsung ke daftar; tidak perlu menunggu
      // putaran polling berikutnya supaya balasan kirim terasa seketika.
      const baru: Pesan | undefined = res.data?.data;
      if (baru) {
        setPesan((sebelum) =>
          sebelum.some((p) => p.id === baru.id) ? sebelum : [...sebelum, baru]
        );
      } else {
        await ambilPesan(aktifId, false, true);
      }
      await ambilRuang();
    } catch (err: unknown) {
      setGalat(pesanGalat(err, 'Pesan gagal dikirim.'));
    } finally {
      setMengirim(false);
    }
  };

  const buatRuang = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalatBuat('');
    if (formBuat.nama.trim().length < 3) {
      setGalatBuat('Nama ruang minimal 3 karakter.');
      return;
    }

    setMenyimpanBuat(true);
    try {
      const res = await api.post('/chat/rooms', {
        nama: formBuat.nama.trim(),
        deskripsi: formBuat.deskripsi.trim(),
      });
      setModalBuat(false);
      setFormBuat({ nama: '', deskripsi: '' });
      await ambilRuang();
      if (res.data?.data?.id) setAktifId(res.data.data.id);
    } catch (err: unknown) {
      setGalatBuat(pesanGalat(err, 'Ruang gagal dibuat.'));
    } finally {
      setMenyimpanBuat(false);
    }
  };

  const ubahStatusRuang = async (ruangAktif: DetailRuang, buka: boolean) => {
    const konfirmasi = buka
      ? 'Buka kembali ruang ini agar anggota bisa mengirim pesan?'
      : 'Tutup ruang ini? Semua orang tetap bisa membaca riwayat, tetapi tidak bisa mengirim pesan baru.';
    if (!window.confirm(konfirmasi)) return;

    setSedangProses('ruang');
    try {
      await api.patch(`/chat/rooms/${ruangAktif.id}`, { isOpen: buka });
      await ambilPesan(ruangAktif.id, false);
      await ambilRuang();
    } catch (err: unknown) {
      setGalat(pesanGalat(err, 'Status ruang gagal diubah.'));
    } finally {
      setSedangProses(null);
    }
  };

  const hapusRuang = async (ruangAktif: DetailRuang) => {
    if (!window.confirm(`Hapus ruang "${ruangAktif.nama}" beserta seluruh pesannya? Tindakan ini tidak dapat dibatalkan.`)) return;

    setSedangProses('hapus-ruang');
    try {
      await api.delete(`/chat/rooms/${ruangAktif.id}`);
      setAktifId(null);
      setDetail(null);
      setPesan([]);
      await ambilRuang();
    } catch (err: unknown) {
      setGalat(pesanGalat(err, 'Ruang gagal dihapus.'));
    } finally {
      setSedangProses(null);
    }
  };

  const hapusPesan = async (id: string) => {
    if (!window.confirm('Hapus pesan ini?')) return;
    setSedangProses(id);
    try {
      await api.delete(`/chat/messages/${id}`);
      // Buang langsung dari layar. Polling delta hanya meminta pesan baru, jadi
      // pesan yang dihapus tidak akan hilang sendiri dari daftar.
      setPesan((lama) => lama.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setGalat(pesanGalat(err, 'Pesan gagal dihapus.'));
    } finally {
      setSedangProses(null);
    }
  };

  const jumlahOnline = online.size;
  const ruangAktif = useMemo(() => ruang.find((r) => r.id === aktifId) ?? null, [ruang, aktifId]);

  // Halaman forum tidak ditampilkan kepada mahasiswa sebelum pengurus membuka
  // ruang pertama. Pengelola forum tetap mendapat halaman ini agar bisa
  // membuat ruang, sedangkan akses langsung lewat URL juga ditutup.
  if (!memuatRuang && !bolehMembuat && !forumTerbuka && !galat) {
    return (
      <div className="max-w-2xl p-6 mx-auto md:p-10">
        <div className="p-8 text-center bg-white border border-gray-100 shadow-sm rounded-2xl dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 text-gray-500 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-300">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">Forum Diskusi Belum Dibuka</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Forum akan muncul setelah pengurus BEM, DPM, atau admin membuka ruang diskusi
            pertama. Silakan kembali lagi nanti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl p-4 mx-auto space-y-5 md:p-8">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <MessagesSquare className="w-6 h-6 text-amber-500" /> Forum Diskusi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ruang obrolan komunitas BEM FT UNAYA. Ruang dibuat oleh pengurus BEM, DPM, atau admin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg dark:text-green-300 dark:bg-green-950/50 dark:border-green-900">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {jumlahOnline} pengguna online
          </span>

          <button
            type="button"
            onClick={() => void ambilRuang()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" /> Segarkan
          </button>

          {bolehMembuat && (
            <>
              <button
                type="button"
                onClick={() => void bukaFilter()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Filter className="w-4 h-4" /> Filtrasi Kata
              </button>
              <button
                type="button"
                onClick={() => { setFormBuat({ nama: '', deskripsi: '' }); setGalatBuat(''); setModalBuat(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500"
              >
                <Plus className="w-4 h-4" /> Buat Ruang
              </button>
            </>
          )}
        </div>
      </div>

      {galat && (
        <div className="flex items-start gap-2 p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {galat}
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-3 text-sm text-green-800 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/60">
          <Check className="w-4 h-4 mt-0.5 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Daftar ruang */}
        <aside className="overflow-hidden bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Ruang Forum</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ruang.length} ruang tersedia</p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {memuatRuang ? (
              <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
            ) : ruang.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Belum ada ruang forum.
                {bolehMembuat ? ' Klik "Buat Ruang" untuk memulai diskusi pertama.' : ' Tunggu pengurus membuka ruang diskusi.'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {ruang.map((r) => {
                  const dipilih = r.id === aktifId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setAktifId(r.id)}
                        aria-current={dipilih ? 'true' : undefined}
                        className={`w-full px-4 py-3 text-left transition ${dipilih ? 'bg-amber-50 dark:bg-amber-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm font-bold ${dipilih ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {r.nama}
                          </span>
                          {r.isOpen ? (
                            <MessageCircle className="w-3.5 h-3.5 shrink-0 text-green-500" aria-label="Ruang terbuka" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-label="Ruang ditutup" />
                          )}
                        </div>
                        {r.pesanTerakhir && (
                          <p className="mt-1 text-xs text-gray-500 truncate dark:text-gray-400">{r.pesanTerakhir.isi}</p>
                        )}
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          {r.jumlahPesan} pesan
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Isi ruang */}
        <section className="flex flex-col overflow-hidden bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl min-h-[60vh]">
          {!ruangAktif ? (
            <div className="flex flex-col items-center justify-center flex-1 p-10 text-center">
              <Users className="w-10 h-10 mb-3 text-amber-400" />
              <p className="font-bold text-gray-900 dark:text-gray-100">Pilih ruang untuk mulai membaca</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Setiap ruang berisi percakapan komunitas yang bisa dibaca semua anggota.
              </p>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-bold text-gray-900 truncate dark:text-gray-100">
                    {ruangAktif.nama}
                    {!ruangAktif.isOpen && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        Ditutup
                      </span>
                    )}
                  </h2>
                  {ruangAktif.deskripsi && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{ruangAktif.deskripsi}</p>
                  )}
                </div>

                {detail?.bolehKelola && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void ubahStatusRuang(detail, !ruangAktif.isOpen)}
                      disabled={sedangProses === 'ruang'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      {ruangAktif.isOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {ruangAktif.isOpen ? 'Tutup' : 'Buka'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void hapusRuang(detail)}
                      disabled={sedangProses === 'hapus-ruang'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 dark:text-red-300 dark:bg-red-950/60"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                )}
              </header>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[55vh]">
                {memuatPesan ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>
                ) : pesan.length === 0 ? (
                  <p className="py-10 text-sm text-center text-gray-500 dark:text-gray-400">
                    Belum ada pesan. Jadilah yang pertama menyapa.
                  </p>
                ) : (
                  pesan.map((p) => {
                    const sendiri = p.penulis.id === user?.id;
                    return (
                      <div key={p.id} className={`flex gap-2 ${sendiri ? 'flex-row-reverse' : ''}`}>
                        <UserAvatar
                          userId={p.penulis.id}
                          nama={p.penulis.nama}
                          foto={p.penulis.foto}
                          size="sm"
                          tone={sendiri ? 'amber' : 'neutral'}
                        />
                        <div className={`max-w-[80%] ${sendiri ? 'items-end text-right' : ''}`}>
                          <div className={`flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 ${sendiri ? 'justify-end' : ''}`}>
                            <span className="font-bold text-gray-700 dark:text-gray-300">{p.penulis.nama}</span>
                            <span className="px-1.5 rounded bg-gray-100 dark:bg-gray-800">{ROLE_LABEL[p.penulis.role] ?? p.penulis.role}</span>
                            <time dateTime={p.createdAt} title={new Date(p.createdAt).toLocaleString('id-ID')}>
                              {tanggalPendek(p.createdAt)} {jam(p.createdAt)}
                            </time>
                          </div>
                          <div className={`mt-1 px-3 py-2 text-sm rounded-2xl whitespace-pre-wrap break-words ${sendiri
                            ? 'bg-amber-400 text-gray-900 rounded-tr-sm'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-tl-sm'
                            }`}>
                            {p.content}
                          </div>
                          {(sendiri || detail?.bolehKelola) && (
                            <button
                              type="button"
                              onClick={() => void hapusPesan(p.id)}
                              disabled={sedangProses === p.id}
                              className="mt-1 text-[10px] font-bold text-gray-400 hover:text-red-500 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={ujungPesan} />
              </div>

              {ruangAktif.isOpen ? (
                <form onSubmit={kirim} className="flex items-end gap-2 p-3 border-t border-gray-200 dark:border-gray-800">
                  <textarea
                    value={isi}
                    onChange={(e) => setIsi(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter mengirim, Shift+Enter membuat baris baru.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void kirim(e);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Tulis pesan… (Enter untuk kirim, Shift+Enter baris baru)"
                    aria-label="Tulis pesan forum"
                    className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg resize-none dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                  <button
                    type="submit"
                    disabled={mengirim || !isi.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mengirim ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Kirim
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 p-3 text-sm text-gray-600 border-t border-gray-200 bg-gray-50 dark:text-gray-300 dark:bg-gray-800/60 dark:border-gray-800">
                  <Lock className="w-4 h-4 shrink-0" /> Ruang ini ditutup. Riwayat tetap bisa dibaca, tetapi pesan baru tidak dapat dikirim.
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Modal buat ruang */}
      {modalBuat && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
          onClick={() => setModalBuat(false)}
          role="presentation"
        >
          <form
            onSubmit={buatRuang}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-buat-ruang"
            className="w-full max-w-md p-6 bg-white shadow-2xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="judul-buat-ruang" className="text-lg font-black text-gray-900 dark:text-gray-100">Buat Ruang Forum</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Ruang hanya dapat dibuat pengurus BEM, DPM, dan admin.
                </p>
              </div>
              <button type="button" onClick={() => setModalBuat(false)} aria-label="Tutup" className="p-1 text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="nama-ruang" className="block mb-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Nama ruang</label>
                <input
                  id="nama-ruang"
                  type="text"
                  required
                  maxLength={100}
                  value={formBuat.nama}
                  onChange={(e) => setFormBuat({ ...formBuat, nama: e.target.value })}
                  placeholder="Contoh: Aspirasi Mahasiswa Baru"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>
              <div>
                <label htmlFor="deskripsi-ruang" className="block mb-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Deskripsi (opsional)</label>
                <textarea
                  id="deskripsi-ruang"
                  rows={3}
                  maxLength={500}
                  value={formBuat.deskripsi}
                  onChange={(e) => setFormBuat({ ...formBuat, deskripsi: e.target.value })}
                  placeholder="Jelaskan topik ruang ini"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg resize-none dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>
              {galatBuat && <p className="text-sm font-bold text-red-600 dark:text-red-400">{galatBuat}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setModalBuat(false)} className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                Batal
              </button>
              <button type="submit" disabled={menyimpanBuat} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                {menyimpanBuat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Buat
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal filtrasi kata */}
      {modalFilter && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
          onClick={() => setModalFilter(false)}
          role="presentation"
        >
          <form
            onSubmit={simpanFilter}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-filter-kata"
            className="w-full max-w-lg p-6 bg-white shadow-2xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="judul-filter-kata" className="text-lg font-black text-gray-900 dark:text-gray-100">
                  Filtrasi Kata Forum
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Kata pada daftar ini otomatis disamarkan menjadi bintang saat pesan dikirim dan ditampilkan.
                </p>
              </div>
              <button type="button" onClick={() => setModalFilter(false)} aria-label="Tutup" className="p-1 text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {memuatFilter ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar kata…
                </div>
              ) : (
                <>
                  <label htmlFor="daftar-kata-filter" className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                    Daftar kata (satu kata per baris)
                  </label>
                  <textarea
                    id="daftar-kata-filter"
                    rows={10}
                    value={kataFilter}
                    onChange={(e) => setKataFilter(e.target.value)}
                    placeholder={'Contoh:\nkata kasar\nspam\nprovokasi'}
                    className="w-full px-3 py-2 text-sm font-mono text-gray-900 bg-white border border-gray-300 rounded-lg resize-y dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Maksimal 200 kata. Kosongkan lalu simpan untuk mematikan filter. Perubahan berlaku paling lambat 30 detik pada server lain.
                  </p>
                </>
              )}
              {galatFilter && <p className="text-sm font-bold text-red-600 dark:text-red-400">{galatFilter}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setModalFilter(false)} className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                Batal
              </button>
              <button type="submit" disabled={menyimpanFilter || memuatFilter} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50">
                {menyimpanFilter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Simpan Filter
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
