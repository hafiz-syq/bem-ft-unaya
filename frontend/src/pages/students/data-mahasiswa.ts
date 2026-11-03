/** Tipe, konstanta, dan pembantu murni halaman Data Mahasiswa. */

export interface Student {
  id: string;
  nim: string;
  role: string;
  isActive: boolean;
  email?: string | null;
  jabatan: string | null;
  organisasi: string | null;
  deactivatedAt: string | null;
  deactivationType: string | null;
  tenggatHapus: string | null;
  perpanjanganHingga: string | null;
  tenggatHapusEfektif: string | null;
  diperpanjangSampai: string | null;
  angkatan: number | null;
  email_verified?: boolean;
  foto?: string | null;
  profile: {
    nama: string;
    program_studi: string;
    email: string | null;
    no_hp: string | null;
    foto?: string | null;
  } | null;
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Jumlah mahasiswa per tahun angkatan pada filter yang sedang aktif. */
  perAngkatan?: { angkatan: number; jumlah: number }[];
  /** Filter angkatan yang sedang dipakai server (null bila tidak ada). */
  angkatan?: number | null;
  /** true bila pemilik sesi hanya boleh membaca direktori (role mahasiswa). */
  hanyaBaca?: boolean;
}

export interface HasilPratinjau {
  totalDibaca: number;
  valid: number;
  siapDiimpor: number;
  sudahTerdaftar: number;
  bermasalah: number;
  contoh: { nama: string; nim: string; program_studi: string }[];
  daftarBermasalah: { nama?: string; nim?: string; alasan: string }[];
}

export interface HasilSimpan {
  dibuat: number;
  dilewati: number;
  gagal: number;
  bermasalah: number;
  daftarGagal: string[];
}

export interface StudentSampah {
  id: string;
  nim: string;
  role: string;
  deletedAt: string;
  deletionReason: string | null;
  profile: { nama: string; program_studi: string; foto: string | null } | null;
}

export type TabData = 'AKTIF' | 'SAMPAH';

export interface FormAkun {
  nama: string;
  program_studi: string;
  email: string;
  no_hp: string;
}

export interface FormTambah extends FormAkun {
  nim: string;
}

export interface FormAdmin {
  nim: string;
  email: string;
  password: string;
  konfirmasi: string;
}

export const LIMIT = 20;

/** Program studi yang dikenali sistem (sama dengan daftar pada impor PDF). */
export const PROGRAM_STUDI = ['SISTEM INFORMASI', 'TEKNIK MESIN', 'TEKNIK SIPIL'] as const;

export const FORM_TAMBAH_KOSONG: FormTambah = {
  nim: '',
  nama: '',
  program_studi: PROGRAM_STUDI[0],
  email: '',
  no_hp: '',
};

export const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
];

/** Tanggal polos (YYYY-MM-DD) untuk input type="date". */
export const keTanggalInput = (nilai: string | null): string =>
  nilai ? new Date(nilai).toISOString().slice(0, 10) : '';

export const formatTanggal = (nilai: string | null): string =>
  nilai
    ? new Date(nilai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
