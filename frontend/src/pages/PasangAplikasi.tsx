import { useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Download, Loader2, Smartphone } from 'lucide-react';
import { berlanggananMode, mintaPasang, modeSaatIni, terpasangSaatIni } from '../lib/pasang-aplikasi';

/**
 * Halaman khusus "cara memasang portal ini sebagai aplikasi" (PWA).
 * Tombol pasangnya selama ini hanya ada di dalam menu lonceng, jadi banyak
 * pengguna tidak pernah melihatnya. Halaman ini memakai store dan keputusan
 * mode yang sama (lib/pasang-aplikasi.ts) — tidak ada logika baru di sini.
 */

const MANFAAT = 'Ikon di layar utama, tetap bisa dibaca tanpa kuota, dan ada notifikasi kegiatan.';

// Diisi setelah Release APK pertama terbit (GitHub > Actions > APK Android).
// Kosong = baris unduh tidak dirender, jadi halaman tidak menunjuk URL mati.
const URL_APK: string =
  'https://github.com/hafiz-syq/bem-ft-unaya/releases/download/apk-v1.0.0/bem-ft-unaya-1.0.0.apk';

const PANDUAN = [
  {
    id: 'android',
    judul: 'Android (Chrome)',
    langkah: [
      'Buka portal ini di Chrome Android.',
      'Ketuk menu ⋮ (tiga titik) di kanan atas.',
      'Pilih "Tambahkan ke layar utama", atau "Install aplikasi" bila muncul.',
      'Konfirmasi "Tambahkan". Ikon BEM-FT UNAYA muncul di layar utama.',
    ],
  },
  {
    id: 'ios',
    judul: 'iPhone / iPad (Safari)',
    langkah: [
      'Buka halaman ini di Safari.',
      'Ketuk ikon Bagikan di bar bawah.',
      'Pilih "Add to Home Screen" (Tambah ke Layar Utama), lalu Ketuk.',
    ],
  },
  {
    id: 'desktop',
    judul: 'Laptop / PC (Chrome atau Edge)',
    langkah: [
      'Buka alamat portal ini di peramban.',
      'Chrome: klik ikon pasang di ujung kanan bar alamat. Edge: menu ⋯ lalu Apps > Install this site as an app.',
      'Portal terbuka di jendela sendiri dan masuk ke daftar aplikasi.',
    ],
  },
];

export default function PasangAplikasi() {
  // Snapshot 'sembunyi'/'false' saat build: status hanya boleh dibaca di klien.
  const mode = useSyncExternalStore(berlanggananMode, modeSaatIni, () => 'sembunyi' as const);
  const terpasang = useSyncExternalStore(berlanggananMode, terpasangSaatIni, () => false);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<'accepted' | 'dismissed' | undefined>(undefined);

  const pasang = async () => {
    setSibuk(true);
    try {
      setHasil(await mintaPasang());
    } catch (error) {
      console.error('Pemasangan aplikasi gagal:', error);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6 md:p-8">
      {/* Header */}
      <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Smartphone className="w-6 h-6 text-amber-400" /> Pasang sebagai aplikasi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{MANFAAT}</p>
      </div>

      {/* Status & tombol pasang */}
      <section className="flex flex-col gap-3 p-4 bg-white border border-gray-100 shadow-sm sm:flex-row sm:items-center sm:justify-between rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            {terpasang ? <CheckCircle2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {terpasang
                ? 'Sudah terpasang'
                : mode === 'otomatis'
                  ? 'Pasang lewat tombol di bawah'
                  : 'Pasang lewat langkah di bawah'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {terpasang
                ? 'Portal ini sedang berjalan sebagai aplikasi, jadi tidak perlu dipasang lagi.'
                : mode === 'otomatis'
                  ? 'Peramban Anda mendukung pemasangan sekali ketuk.'
                  : mode === 'manual'
                    ? 'Safari di iPhone/iPad tidak menerima tombol otomatis, jadi ikuti langkah manual di bawah.'
                    : 'Tombol otomatis belum tersedia di peramban ini. Muat ulang halaman, atau pasang lewat langkah di bawah.'}
            </p>
          </div>
        </div>

        {!terpasang && mode === 'otomatis' && (
          <button
            type="button"
            onClick={pasang}
            disabled={sibuk}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 shrink-0"
          >
            {sibuk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pasang aplikasi sekarang
          </button>
        )}
      </section>

      {hasil === 'dismissed' && (
        <p className="p-4 text-sm text-gray-600 bg-white border border-gray-100 rounded-xl dark:text-gray-300 dark:bg-gray-900 dark:border-gray-800">
          Pemasangan dibatalkan. Muat ulang halaman ini untuk memunculkan dialog pasang lagi.
        </p>
      )}

      {/* Berkas APK (cangkang TWA) — hanya muncul setelah Release pertama terbit. */}
      {URL_APK && (
        <section className="flex flex-col gap-3 p-4 bg-white border border-gray-100 shadow-sm sm:flex-row sm:items-center sm:justify-between rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <Download className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Berkas APK untuk Android
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Versi cangkang: ikonnya tetap membuka portal yang sama. Buka berkas hasil unduhan di HP,
                lalu izinkan instal dari sumber tidak dikenal. Tidak diperbarui otomatis — unduh ulang bila
                ada versi baru. iPhone/iPad tidak memakai berkas ini.
              </p>
            </div>
          </div>
          <a
            href={URL_APK}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 shrink-0"
          >
            <Download className="w-4 h-4" /> Unduh APK
          </a>
        </section>
      )}

      {/* Langkah per perangkat */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PANDUAN.map((grup) => {
          const utama = mode === 'manual' && grup.id === 'ios';
          return (
            <div
              key={grup.id}
              className={`p-5 bg-white border shadow-sm rounded-xl dark:bg-gray-900 ${utama ? 'border-amber-400' : 'border-gray-100 dark:border-gray-800'}`}
            >
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {grup.judul}
                {utama && (
                  <span className="ml-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    untuk perangkat Anda
                  </span>
                )}
              </h3>
              <ol className="px-4 mt-3 space-y-2 list-decimal text-xs leading-snug text-gray-600 dark:text-gray-300">
                {grup.langkah.map((langkah) => (
                  <li key={langkah}>{langkah}</li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Setelah terpasang, notifikasi kegiatan dinyalakan dari menu lonceng di kanan atas halaman
        dashboard.
      </p>
    </div>
  );
}
