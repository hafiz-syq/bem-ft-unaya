import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, RefreshCw,
} from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/axios';
import {
  formatRentangTanggal, formatTanggal, jumlahHariAgenda, kunciHariIni, kunciTanggal,
  tanggalDalamAgenda,
} from '../lib/tanggal';

export interface AgendaKalender {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string | null;
  time: string;
  location: string;
  color: string;
  status: string;
}

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WARNA_BAWAAN = '#F59E0B';

/** Warna teks yang tetap terbaca di atas warna latar bebas pilihan pengguna. */
const teksKontras = (hex: string): string => {
  const bersih = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : WARNA_BAWAAN.slice(1);
  const r = parseInt(bersih.slice(0, 2), 16);
  const g = parseInt(bersih.slice(2, 4), 16);
  const b = parseInt(bersih.slice(4, 6), 16);
  const kecerahan = (r * 299 + g * 587 + b * 114) / 1000;
  return kecerahan > 150 ? '#111827' : '#FFFFFF';
};

const kunciDariSel = (tanggal: Date): string => tanggal.toISOString().slice(0, 10);

interface SelKalender {
  kunci: string;
  hari: number;
  dalamBulan: boolean;
}

/** Menyusun sel kalender Senin–Minggu, lengkap dengan hari dari bulan tetangga. */
const susunSel = (tahun: number, bulan: number): SelKalender[] => {
  const hariPertama = new Date(Date.UTC(tahun, bulan, 1));
  const offset = (hariPertama.getUTCDay() + 6) % 7;
  const jumlahHari = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();

  const sel: SelKalender[] = [];
  for (let i = offset; i > 0; i -= 1) {
    const tanggal = new Date(Date.UTC(tahun, bulan, 1 - i));
    sel.push({ kunci: kunciDariSel(tanggal), hari: tanggal.getUTCDate(), dalamBulan: false });
  }
  for (let hari = 1; hari <= jumlahHari; hari += 1) {
    sel.push({ kunci: kunciDariSel(new Date(Date.UTC(tahun, bulan, hari))), hari, dalamBulan: true });
  }
  while (sel.length % 7 !== 0) {
    const tanggal = new Date(Date.UTC(tahun, bulan + 1, sel.length - offset - jumlahHari + 1));
    sel.push({ kunci: kunciDariSel(tanggal), hari: tanggal.getUTCDate(), dalamBulan: false });
  }
  return sel;
};

/**
 * Kalender agenda di dashboard.
 *
 * Data diambil langsung dari `/cms/agendas`, jadi begitu pengurus/admin
 * menyimpan agenda di CMS, kalender ini menampilkannya pada pemuatan berikutnya,
 * saat tab kembali difokuskan, dan lewat pembaruan otomatis tiap menit.
 * Kegiatan multi-hari mengisi seluruh tanggal dalam rentangnya dengan warna
 * yang dipilih saat membuat agenda.
 */
export default function AgendaCalendar() {
  const [agenda, setAgenda] = useState<AgendaKalender[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [terakhirDimuat, setTerakhirDimuat] = useState<Date | null>(null);
  const [dipilih, setDipilih] = useState<string>(kunciHariIni());

  const sekarang = new Date();
  const [tahun, setTahun] = useState(sekarang.getFullYear());
  const [bulan, setBulan] = useState(sekarang.getMonth());

  const muat = useCallback(async () => {
    try {
      const res = await api.get('/cms/agendas');
      setAgenda(res.data.data as AgendaKalender[]);
      setGalat('');
      setTerakhirDimuat(new Date());
    } catch (error) {
      setGalat(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Gagal memuat agenda kegiatan.'
          : 'Gagal memuat agenda kegiatan.'
      );
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    muat();
  }, [muat]);

  // Sinkronisasi ringan: segarkan saat tab aktif kembali dan tiap menit.
  useEffect(() => {
    const saatFokus = () => { void muat(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void muat();
    }, 60_000);

    window.addEventListener('focus', saatFokus);
    document.addEventListener('visibilitychange', saatFokus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', saatFokus);
      document.removeEventListener('visibilitychange', saatFokus);
    };
  }, [muat]);

  const sel = useMemo(() => susunSel(tahun, bulan), [tahun, bulan]);
  const awalBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
  const akhirBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${new Date(
    Date.UTC(tahun, bulan + 1, 0)
  ).getUTCDate()}`;

  const agendaBulanIni = useMemo(
    () => agenda
      .filter((item) => {
        const mulai = kunciTanggal(item.date);
        const selesai = kunciTanggal(item.endDate) ?? mulai;
        return Boolean(mulai && selesai && mulai <= akhirBulan && selesai >= awalBulan);
      })
      .sort((a, b) => (kunciTanggal(a.date) ?? '').localeCompare(kunciTanggal(b.date) ?? '')),
    [agenda, awalBulan, akhirBulan]
  );

  const agendaTanggalDipilih = useMemo(
    () => agendaBulanIni.filter((item) => tanggalDalamAgenda(dipilih, item)),
    [agendaBulanIni, dipilih]
  );

  const hariIni = kunciHariIni();

  const geserBulan = (arah: number) => {
    const tanggal = new Date(Date.UTC(tahun, bulan + arah, 1));
    setTahun(tanggal.getUTCFullYear());
    setBulan(tanggal.getUTCMonth());
  };

  const keHariIni = () => {
    const tanggal = new Date();
    setTahun(tanggal.getFullYear());
    setBulan(tanggal.getMonth());
    setDipilih(kunciHariIni());
  };

  return (
    <section className="p-4 bg-white border border-gray-100 shadow-sm dark:bg-gray-900 dark:border-gray-800 sm:p-6 rounded-xl">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
            <CalendarDays className="w-5 h-5 text-amber-500" /> Kalender Kegiatan
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Warna setiap kegiatan diatur saat membuat agenda di CMS.
            {terakhirDimuat && ` Diperbarui ${terakhirDimuat.toLocaleTimeString('id-ID')}.`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => geserBulan(-1)}
            aria-label="Bulan sebelumnya"
            className="p-2 text-gray-600 transition rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-black text-gray-900 dark:text-gray-100">
            {BULAN[bulan]} {tahun}
          </span>
          <button
            type="button"
            onClick={() => geserBulan(1)}
            aria-label="Bulan berikutnya"
            className="p-2 text-gray-600 transition rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={keHariIni}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => void muat()}
            aria-label="Muat ulang agenda"
            className="p-2 text-gray-600 transition rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {galat && (
        <div className="p-3 mb-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
          {galat}
        </div>
      )}

      {memuat ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 mb-1">
            {HARI.map((hari) => (
              <div
                key={hari}
                className="py-1 text-[10px] font-bold tracking-wide text-center text-gray-500 uppercase dark:text-gray-400"
              >
                {hari}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {sel.map((item) => {
              const kegiatan = agendaBulanIni.filter((a) => tanggalDalamAgenda(item.kunci, a));
              const terpilih = dipilih === item.kunci;
              const iniHariIni = hariIni === item.kunci;

              return (
                <div
                  key={item.kunci}
                  className={`min-h-[4.5rem] sm:min-h-[5.5rem] rounded-lg border p-1 transition ${
                    terpilih
                      ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/30'
                      : 'border-gray-100 dark:border-gray-800'
                  } ${item.dalamBulan ? '' : 'opacity-45'}`}
                >
                  <button
                    type="button"
                    onClick={() => setDipilih(item.kunci)}
                    aria-label={`Pilih tanggal ${formatTanggal(item.kunci, {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}`}
                    aria-pressed={terpilih}
                    className={`flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full transition ${
                      iniHariIni
                        ? 'bg-amber-500 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {item.hari}
                  </button>

                  <div className="mt-1 space-y-0.5">
                    {kegiatan.slice(0, 2).map((a) => {
                      const warna = /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : WARNA_BAWAAN;
                      const mulai = kunciTanggal(a.date);
                      const selesai = kunciTanggal(a.endDate) ?? mulai;
                      const awalRentang = mulai === item.kunci;
                      const akhirRentang = selesai === item.kunci;

                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setDipilih(item.kunci)}
                          title={`${a.title} — ${formatRentangTanggal(a.date, a.endDate)}`}
                          style={{ backgroundColor: warna, color: teksKontras(warna) }}
                          className={`block w-full px-1 text-[9px] font-bold leading-tight truncate text-left ${
                            awalRentang ? 'py-0.5' : 'h-1.5 sm:h-auto sm:py-0.5'
                          } ${awalRentang ? 'rounded-l' : 'rounded-l-none'} ${
                            akhirRentang ? 'rounded-r' : 'rounded-r-none'
                          }`}
                        >
                          {awalRentang ? a.title : <span className="sr-only">{a.title}</span>}
                        </button>
                      );
                    })}
                    {kegiatan.length > 2 && (
                      <span className="block px-1 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                        +{kegiatan.length - 2} lagi
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 mt-5 lg:grid-cols-2">
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatTanggal(dipilih, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {agendaTanggalDipilih.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tidak ada kegiatan pada tanggal ini.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {agendaTanggalDipilih.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 mt-1 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{a.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRentangTanggal(a.date, a.endDate)} • {a.time} WIB
                    </p>
                    <p className="flex items-center gap-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{a.location}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Kegiatan {BULAN[bulan]} ({agendaBulanIni.length})
          </h3>
          {agendaBulanIni.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Belum ada agenda pada bulan ini.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {agendaBulanIni.map((a) => {
                const hari = jumlahHariAgenda(a.date, a.endDate);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setDipilih(kunciTanggal(a.date) ?? dipilih)}
                      className="flex w-full items-start gap-2 text-left rounded-lg px-1 py-1 hover:bg-white dark:hover:bg-gray-900"
                    >
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 mt-1 rounded-full shrink-0"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                          {a.title}
                        </span>
                        <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                          {formatRentangTanggal(a.date, a.endDate)}
                          {hari > 1 ? ` • ${hari} hari` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {!memuat && agenda.length === 0 && (
        <p className="flex items-center gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" /> Belum ada agenda. Tambahkan lewat CMS → Agenda Kegiatan.
        </p>
      )}
    </section>
  );
}
