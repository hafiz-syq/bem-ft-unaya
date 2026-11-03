import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Search, Upload, X } from 'lucide-react';
import type { HasilPratinjau, HasilSimpan } from './data-mahasiswa';

interface Props {
  setImporTerbuka: Dispatch<SetStateAction<boolean>>;
  berkas: File | null;
  setBerkas: Dispatch<SetStateAction<File | null>>;
  pratinjau: HasilPratinjau | null;
  setPratinjau: Dispatch<SetStateAction<HasilPratinjau | null>>;
  hasilImpor: HasilSimpan | null;
  setHasilImpor: Dispatch<SetStateAction<HasilSimpan | null>>;
  galatImpor: string;
  setGalatImpor: Dispatch<SetStateAction<string>>;
  memuatPratinjau: boolean;
  menyimpanImpor: boolean;
  pratinjauImpor: () => void;
  simpanImpor: () => void;
}

/** Modal impor mahasiswa dari PDF: pratinjau dulu, akun dibuat sesudah diperiksa. */
export default function ModalImpor({
  setImporTerbuka,
  berkas,
  setBerkas,
  pratinjau,
  setPratinjau,
  hasilImpor,
  setHasilImpor,
  galatImpor,
  setGalatImpor,
  memuatPratinjau,
  menyimpanImpor,
  pratinjauImpor,
  simpanImpor,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Impor mahasiswa" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setImporTerbuka(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <FileUp className="w-5 h-5 text-amber-400" /> Impor Mahasiswa dari PDF
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sama seperti proses seed: PDF dibaca dulu, Anda periksa hasilnya, baru akun dibuat. NIM yang sudah ada dilewati.
            </p>
          </div>
          <button type="button" onClick={() => setImporTerbuka(false)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {galatImpor && (
            <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatImpor}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Berkas PDF data mahasiswa</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => { setBerkas(e.target.files?.[0] ?? null); setPratinjau(null); setHasilImpor(null); setGalatImpor(''); }}
              className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-sm file:font-bold file:bg-amber-100 file:text-amber-700 dark:file:bg-amber-900/40 dark:file:text-amber-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Maksimal 10 MB. PDF hasil pindai/gambar tidak bisa dibaca — perlu diketik ulang atau di-OCR lebih dulu.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pratinjauImpor}
              disabled={!berkas || memuatPratinjau || menyimpanImpor}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
            >
              {memuatPratinjau ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Pratinjau PDF
            </button>

            {pratinjau && pratinjau.siapDiimpor > 0 && (
              <button
                type="button"
                onClick={simpanImpor}
                disabled={menyimpanImpor}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {menyimpanImpor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Buat {pratinjau.siapDiimpor} Akun
              </button>
            )}
          </div>

          {pratinjau && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Terbaca', nilai: pratinjau.totalDibaca },
                  { label: 'Siap dibuat', nilai: pratinjau.siapDiimpor },
                  { label: 'Sudah ada', nilai: pratinjau.sudahTerdaftar },
                  { label: 'Bermasalah', nilai: pratinjau.bermasalah },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="text-xl font-black text-gray-900 dark:text-gray-100">{item.nilai}</p>
                  </div>
                ))}
              </div>

              {pratinjau.contoh.length > 0 && (
                <div className="overflow-hidden border border-gray-200 rounded-lg dark:border-gray-800">
                  <table className="w-full text-left">
                    <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="p-2 font-medium">Nama</th>
                        <th className="p-2 font-medium">NIM</th>
                        <th className="p-2 font-medium">Prodi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
                      {pratinjau.contoh.map((c) => (
                        <tr key={c.nim}>
                          <td className="p-2 text-gray-700 dark:text-gray-300">{c.nama}</td>
                          <td className="p-2 font-medium text-gray-900 dark:text-gray-100">{c.nim}</td>
                          <td className="p-2 text-gray-600 dark:text-gray-400">{c.program_studi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pratinjau.daftarBermasalah.length > 0 && (
                <div className="p-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                  <p className="font-bold">Baris yang tidak akan diimpor:</p>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    {pratinjau.daftarBermasalah.slice(0, 10).map((b, i) => (
                      <li key={`${b.nim ?? 'x'}-${i}`}>
                        {b.nim || '(NIM kosong)'} {b.nama ? `— ${b.nama}` : ''}: {b.alasan}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {hasilImpor && (
            <div className="p-4 space-y-2 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-200">
              <p className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Impor selesai
              </p>
              <p>
                {hasilImpor.dibuat} akun dibuat, {hasilImpor.dilewati} NIM dilewati (sudah ada),{' '}
                {hasilImpor.gagal} gagal, {hasilImpor.bermasalah} baris bermasalah di berkas.
              </p>
              <p className="text-xs">Password awal setiap akun sama dengan NIM dan wajib diganti saat login pertama.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setImporTerbuka(false)}
            className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
