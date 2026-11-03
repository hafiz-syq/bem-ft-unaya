import { ChevronLeft, ChevronRight, Loader2, Trash2, Undo2 } from 'lucide-react';
import { formatTanggal, type StudentSampah } from './data-mahasiswa';

interface Props {
  sampah: StudentSampah[];
  memuatSampah: boolean;
  sedangProses: string | null;
  halaman: number;
  totalHalaman: number;
  setHalaman: (pengatur: (p: number) => number) => void;
  pulihkanSiswa: (s: StudentSampah) => void;
  hapusPermanen: (s: StudentSampah) => void;
}

/** Tabel tempat sampah mahasiswa: pemulihan & penghapusan permanen. */
export default function TabelSampah({
  sampah,
  memuatSampah,
  sedangProses,
  halaman,
  totalHalaman,
  setHalaman,
  pulihkanSiswa,
  hapusPermanen,
}: Props) {
  return (
    <div className="overflow-hidden bg-white border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800 rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-gray-500 border-b border-gray-200 dark:text-gray-400 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
              <th className="p-4 font-medium">NIM</th>
              <th className="p-4 font-medium">Nama</th>
              <th className="p-4 font-medium">Program Studi</th>
              <th className="p-4 font-medium">Dihapus</th>
              <th className="p-4 font-medium text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {memuatSampah ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" /></td></tr>
            ) : sampah.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">Tempat sampah kosong.</td></tr>
            ) : (
              sampah.map((s) => (
                <tr key={s.id} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{s.nim}</td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">
                    <p className="font-bold">{s.profile?.nama || '-'}</p>
                    {s.deletionReason && <p className="text-xs text-gray-400">{s.deletionReason}</p>}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">{s.profile?.program_studi || '-'}</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{formatTanggal(s.deletedAt)}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => pulihkanSiswa(s)}
                        disabled={sedangProses === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-green-700 rounded-lg bg-green-50 hover:bg-green-100 dark:text-green-300 dark:bg-green-950/60 disabled:opacity-50"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Pulihkan
                      </button>
                      <button
                        type="button"
                        onClick={() => hapusPermanen(s)}
                        disabled={sedangProses === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-600 rounded-lg bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/60 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus permanen
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!memuatSampah && totalHalaman > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Halaman {halaman} dari {totalHalaman}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setHalaman((p) => Math.max(1, p - 1))}
              disabled={halaman === 1}
              className="p-2 text-gray-600 border border-gray-300 rounded-lg dark:text-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHalaman((p) => Math.min(totalHalaman, p + 1))}
              disabled={halaman === totalHalaman}
              className="p-2 text-gray-600 border border-gray-300 rounded-lg dark:text-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
