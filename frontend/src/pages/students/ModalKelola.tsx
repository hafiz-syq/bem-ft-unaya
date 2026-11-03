import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, UserCog, X } from 'lucide-react';
import { formatTanggal, type Student } from './data-mahasiswa';

interface Props {
  kelola: Student;
  setKelola: (s: Student | null) => void;
  tglPerpanjangan: string;
  setTglPerpanjangan: Dispatch<SetStateAction<string>>;
  tglTenggat: string;
  setTglTenggat: Dispatch<SetStateAction<string>>;
  aktifkan: boolean;
  setAktifkan: Dispatch<SetStateAction<boolean>>;
  /** Batas tanggal input, dihitung sekali saat halaman dipasang. */
  batasTanggal: { hariIni: string; duaHari: string };
  galatKelola: string;
  menyimpanKelola: boolean;
  simpanKelola: (e: FormEvent) => void;
}

/** Modal kelola akun: perpanjangan masa studi & tenggat hapus. */
export default function ModalKelola({
  kelola,
  setKelola,
  tglPerpanjangan,
  setTglPerpanjangan,
  tglTenggat,
  setTglTenggat,
  aktifkan,
  setAktifkan,
  batasTanggal,
  galatKelola,
  menyimpanKelola,
  simpanKelola,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Kelola mahasiswa" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setKelola(null)}>
      <form
        onSubmit={simpanKelola}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <UserCog className="w-5 h-5 text-amber-400" /> Kelola Akun
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {kelola.profile?.nama ?? '-'} • {kelola.nim}
            </p>
          </div>
          <button type="button" onClick={() => setKelola(null)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {galatKelola && (
            <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatKelola}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Status saat ini</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{kelola.isActive ? 'Aktif' : 'Nonaktif'}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {kelola.deactivationType === 'AUTO'
                  ? 'Nonaktif otomatis (masa studi 5 tahun)'
                  : kelola.deactivationType === 'MANUAL'
                    ? 'Dinonaktifkan manual'
                    : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Tenggat hapus berlaku</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{formatTanggal(kelola.tenggatHapusEfektif)}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Perpanjangan s.d. {formatTanggal(kelola.diperpanjangSampai)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Perpanjang masa studi sampai
            </label>
            <input
              type="date"
              value={tglPerpanjangan}
              min={batasTanggal.hariIni}
              onChange={(e) => setTglPerpanjangan(e.target.value)}
              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Selama tanggal ini belum lewat, akun tidak dinonaktifkan otomatis. Kosongkan untuk mencabut perpanjangan.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Geser tenggat hapus
            </label>
            <input
              type="date"
              value={tglTenggat}
              min={batasTanggal.duaHari}
              onChange={(e) => setTglTenggat(e.target.value)}
              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Minimal sehari dari sekarang. Kosongkan untuk kembali ke aturan bawaan (1 tahun setelah nonaktif).
            </p>
          </div>

          {!kelola.isActive && (
            <label className="flex items-start gap-2 p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
              <input
                type="checkbox"
                checked={aktifkan}
                onChange={(e) => setAktifkan(e.target.checked)}
                className="mt-0.5 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
              />
              <span>Aktifkan kembali akun ini saat disimpan.</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setKelola(null)}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={menyimpanKelola}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
          >
            {menyimpanKelola ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan</>}
          </button>
        </div>
      </form>
    </div>
  );
}
