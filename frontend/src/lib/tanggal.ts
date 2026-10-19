/**
 * Utilitas tanggal untuk agenda kegiatan.
 *
 * API menyimpan tanggal sebagai ISO (mis. `2026-10-19T00:00:00.000Z`). Semua
 * tampilan di sini memakai zona UTC supaya tanggal yang dipilih admin tidak
 * bergeser satu hari saat halaman dibuka dari zona waktu lain. Kunci tanggal
 * selalu berbentuk `YYYY-MM-DD` sehingga bisa dibandingkan langsung sebagai
 * teks (urutannya sama dengan urutan tanggal).
 */

const POLA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

export const kunciTanggal = (nilai?: string | null): string | null => {
  if (!nilai) return null;

  const cocok = POLA_ISO.exec(nilai);
  if (cocok) return `${cocok[1]}-${cocok[2]}-${cocok[3]}`;

  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return null;

  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
};

const keTanggal = (nilai: string): Date => new Date(`${kunciTanggal(nilai)}T00:00:00Z`);

/** Tanggal hari ini menurut jam perangkat, dalam bentuk `YYYY-MM-DD`. */
export const kunciHariIni = (): string => {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
  const hari = String(sekarang.getDate()).padStart(2, '0');
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
};

export const formatTanggal = (
  nilai: string | null | undefined,
  opsi: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
): string => {
  if (!nilai) return '';
  return keTanggal(nilai).toLocaleDateString('id-ID', { timeZone: 'UTC', ...opsi });
};

/**
 * Teks rentang tanggal yang enak dibaca.
 * - Satu hari: "Senin, 19 Oktober 2026"
 * - Beberapa hari: "19–21 Oktober 2026" atau "30 Oktober – 2 November 2026"
 */
export const formatRentangTanggal = (
  mulai: string | null | undefined,
  selesai?: string | null
): string => {
  const awal = kunciTanggal(mulai);
  const akhir = kunciTanggal(selesai);
  if (!awal) return '';
  if (!akhir || akhir === awal) {
    return formatTanggal(mulai, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const tahunAwal = awal.slice(0, 4);
  const tahunAkhir = akhir.slice(0, 4);
  const bulanAwal = awal.slice(5, 7);
  const bulanAkhir = akhir.slice(5, 7);

  if (tahunAwal === tahunAkhir && bulanAwal === bulanAkhir) {
    return `${Number(awal.slice(8, 10))}–${Number(akhir.slice(8, 10))} ${formatTanggal(mulai, {
      month: 'long',
      year: 'numeric',
    })}`;
  }

  if (tahunAwal === tahunAkhir) {
    return `${formatTanggal(mulai, { day: 'numeric', month: 'short' })} – ${formatTanggal(akhir, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  return `${formatTanggal(mulai, { day: 'numeric', month: 'short', year: 'numeric' })} – ${formatTanggal(
    akhir,
    { day: 'numeric', month: 'short', year: 'numeric' }
  )}`;
};

/** Jumlah hari kegiatan (inklusif). Agenda satu hari bernilai 1. */
export const jumlahHariAgenda = (mulai: string, selesai?: string | null): number => {
  const awal = kunciTanggal(mulai);
  if (!awal) return 1;
  const akhir = kunciTanggal(selesai) ?? awal;
  const selisih = keTanggal(akhir).getTime() - keTanggal(awal).getTime();
  return Math.max(1, Math.round(selisih / 86_400_000) + 1);
};

/** Apakah sebuah tanggal (`YYYY-MM-DD`) berada di dalam rentang agenda. */
export const tanggalDalamAgenda = (
  kunci: string,
  agenda: { date: string; endDate?: string | null }
): boolean => {
  const mulai = kunciTanggal(agenda.date);
  const selesai = kunciTanggal(agenda.endDate) ?? mulai;
  if (!mulai || !selesai) return false;
  return kunci >= mulai && kunci <= selesai;
};
