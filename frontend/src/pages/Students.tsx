import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/axios';
import {
  Search, Loader2, ChevronLeft, ChevronRight, Download, FileSpreadsheet,
  Upload, UserCog, CalendarClock, X, AlertTriangle, CheckCircle2, FileUp, UserPlus,
  ShieldCheck,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import {
  ASSIGNABLE_ROLES, ROLE_ADMIN, ROLE_LABEL, ROLE_SUPERADMIN, isAdminRole,
} from '../lib/roles';

interface Student {
  id: string;
  nim: string;
  role: string;
  isActive: boolean;
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
    foto?: string | null;
  } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface HasilPratinjau {
  totalDibaca: number;
  valid: number;
  siapDiimpor: number;
  sudahTerdaftar: number;
  bermasalah: number;
  contoh: { nama: string; nim: string; program_studi: string }[];
  daftarBermasalah: { nama?: string; nim?: string; alasan: string }[];
}

interface HasilSimpan {
  dibuat: number;
  dilewati: number;
  gagal: number;
  bermasalah: number;
  daftarGagal: string[];
}

const LIMIT = 20;

/** Program studi yang dikenali sistem (sama dengan daftar pada impor PDF). */
const PROGRAM_STUDI = ['SISTEM INFORMASI', 'TEKNIK MESIN', 'TEKNIK SIPIL'] as const;

const FORM_TAMBAH_KOSONG = {
  nim: '',
  nama: '',
  program_studi: PROGRAM_STUDI[0] as string,
  email: '',
  no_hp: '',
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
];

/**
 * Ambil pesan kesalahan dari server.
 * Ekspor CSV memakai responseType 'blob', sehingga balasan galat pun berupa Blob
 * dan harus dibaca sebagai teks dulu sebelum bisa diparse sebagai JSON.
 */
async function pesanKesalahan(err: unknown, bawaan: string): Promise<string> {
  if (!axios.isAxiosError(err)) return 'Terjadi kesalahan yang tidak terduga.';

  const data = err.response?.data;
  if (typeof data === 'string' || data instanceof Blob) {
    try {
      const teks = typeof data === 'string' ? data : await data.text();
      const pesan = (JSON.parse(teks) as { message?: string }).message;
      if (pesan) return pesan;
    } catch {
      // Balasan bukan JSON, pakai pesan bawaan.
    }
  } else if (data && typeof data.message === 'string') {
    return data.message;
  }

  return bawaan;
}

/** Tanggal polos (YYYY-MM-DD) untuk input type="date". */
const keTanggalInput = (nilai: string | null): string =>
  nilai ? new Date(nilai).toISOString().slice(0, 10) : '';

const formatTanggal = (nilai: string | null): string =>
  nilai
    ? new Date(nilai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function Students() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const isSuperadmin = user?.role === ROLE_SUPERADMIN;

  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  // `search` = isi kotak pencarian, `kataKunci` = yang benar-benar dipakai server.
  const [search, setSearch] = useState('');
  const [kataKunci, setKataKunci] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sedangProses, setSedangProses] = useState<string | null>(null);

  // Batas tanggal dihitung sekali saat komponen dipasang, bukan setiap render
  // (memanggil Date.now() saat render membuat hasilnya tidak stabil).
  const [batasTanggal] = useState(() => ({
    hariIni: new Date().toISOString().slice(0, 10),
    duaHari: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }));

  // --- Modal kelola akun (perpanjangan & tenggat hapus) ---
  const [kelola, setKelola] = useState<Student | null>(null);
  const [tglPerpanjangan, setTglPerpanjangan] = useState('');
  const [tglTenggat, setTglTenggat] = useState('');
  const [aktifkan, setAktifkan] = useState(false);
  const [menyimpanKelola, setMenyimpanKelola] = useState(false);
  const [galatKelola, setGalatKelola] = useState('');

  // --- Modal tambah akun administrator (khusus SUPERADMIN) ---
  const [adminTerbuka, setAdminTerbuka] = useState(false);
  const [formAdmin, setFormAdmin] = useState({ nim: '', email: '', password: '', konfirmasi: '' });
  const [menyimpanAdmin, setMenyimpanAdmin] = useState(false);
  const [galatAdmin, setGalatAdmin] = useState('');

  // --- Modal tambah mahasiswa manual (satu per satu) ---
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [formTambah, setFormTambah] = useState({ ...FORM_TAMBAH_KOSONG });
  const [menyimpanTambah, setMenyimpanTambah] = useState(false);
  const [galatTambah, setGalatTambah] = useState('');

  // --- Modal impor PDF ---
  const [imporTerbuka, setImporTerbuka] = useState(false);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);
  const [menyimpanImpor, setMenyimpanImpor] = useState(false);
  const [pratinjau, setPratinjau] = useState<HasilPratinjau | null>(null);
  const [hasilImpor, setHasilImpor] = useState<HasilSimpan | null>(null);
  const [galatImpor, setGalatImpor] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/students', {
        params: {
          page,
          limit: LIMIT,
          search: kataKunci || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
        },
      });
      setStudents(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal memuat data mahasiswa'));
    } finally {
      setLoading(false);
    }
  }, [page, kataKunci, status, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudents();
  }, [fetchStudents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setKataKunci(search.trim());
  };

  const handleExportCsv = async () => {
    if (!window.confirm('Unduh seluruh data mahasiswa dalam bentuk CSV?')) return;

    setExporting(true);
    setNotice('');
    try {
      const res = await api.get('/students/export', {
        responseType: 'blob',
        params: {
          search: kataKunci || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
        },
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data-mahasiswa-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setNotice('Data mahasiswa berhasil diunduh sebagai CSV.');
    } catch (err) {
      alert(await pesanKesalahan(err, 'Gagal mengunduh CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const ubahFilter = (ubah: () => void) => {
    ubah();
    setPage(1);
  };

  // ---------------- Role & status ----------------

  /** Pilihan filter role (SUPERADMIN tidak pernah ditampilkan di daftar). */
  const opsiFilterRole = useMemo(() => {
    return [...ASSIGNABLE_ROLES].filter((r) => isSuperadmin || r !== ROLE_ADMIN);
  }, [isSuperadmin]);

  /** Pilihan role yang bisa DITETAPKAN; superadmin menambah satu opsi. */
  const opsiRoleBaru = useMemo(
    () => (isSuperadmin ? [...opsiFilterRole, ROLE_SUPERADMIN] : opsiFilterRole),
    [isSuperadmin, opsiFilterRole]
  );

  const bolehUbahRole = (s: Student): boolean => {
    if (!isAdmin) return false;
    if (s.id === user?.id) return false;
    if (s.role === ROLE_SUPERADMIN) return false;
    if (s.role === ROLE_ADMIN) return isSuperadmin;
    return true;
  };

  const ubahRole = async (s: Student, roleBaru: string) => {
    if (roleBaru === s.role) return;
    const label = ROLE_LABEL[roleBaru] ?? roleBaru;
    if (!window.confirm(`Ubah role ${s.profile?.nama || s.nim} dari ${ROLE_LABEL[s.role] ?? s.role} menjadi ${label}?`)) {
      await fetchStudents();
      return;
    }

    setSedangProses(s.id);
    setError('');
    setNotice('');
    try {
      const res = await api.patch(`/students/${s.id}/role`, { role: roleBaru });
      setNotice(res.data.message || 'Role berhasil diubah.');
      await fetchStudents();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal mengubah role.'));
      await fetchStudents();
    } finally {
      setSedangProses(null);
    }
  };

  const ubahStatus = async (s: Student) => {
    const aksi = s.isActive ? 'menonaktifkan' : 'mengaktifkan';
    if (!window.confirm(`Yakin ${aksi} akun ${s.profile?.nama || s.nim} (${s.nim})?`)) return;

    setSedangProses(s.id);
    setError('');
    setNotice('');
    try {
      const res = await api.patch(`/students/${s.id}/status`, { isActive: !s.isActive });
      setNotice(res.data.message || 'Status akun diperbarui.');
      await fetchStudents();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal mengubah status akun.'));
    } finally {
      setSedangProses(null);
    }
  };

  // ---------------- Tambah mahasiswa manual ----------------

  const bukaTambah = () => {
    setFormTambah({ ...FORM_TAMBAH_KOSONG });
    setGalatTambah('');
    setTambahTerbuka(true);
  };

  const simpanTambah = async (e: FormEvent) => {
    e.preventDefault();
    setMenyimpanTambah(true);
    setGalatTambah('');
    try {
      const res = await api.post('/students', {
        nim: formTambah.nim.trim(),
        nama: formTambah.nama.trim(),
        program_studi: formTambah.program_studi,
        email: formTambah.email.trim() || null,
        no_hp: formTambah.no_hp.trim() || null,
      });
      setNotice(res.data.message || 'Akun mahasiswa berhasil dibuat.');
      setTambahTerbuka(false);
      setFormTambah({ ...FORM_TAMBAH_KOSONG });
      // Akun baru bisa berada di halaman lain; kembali ke halaman pertama.
      if (page === 1) await fetchStudents();
      else setPage(1);
    } catch (err) {
      setGalatTambah(await pesanKesalahan(err, 'Gagal menambah mahasiswa.'));
    } finally {
      setMenyimpanTambah(false);
    }
  };

  // ---------------- Tambah akun administrator ----------------

  const bukaTambahAdmin = () => {
    setFormAdmin({ nim: '', email: '', password: '', konfirmasi: '' });
    setGalatAdmin('');
    setAdminTerbuka(true);
  };

  const simpanAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setGalatAdmin('');

    if (formAdmin.password.length < 8) {
      setGalatAdmin('Password minimal 8 karakter.');
      return;
    }
    if (formAdmin.password !== formAdmin.konfirmasi) {
      setGalatAdmin('Konfirmasi password tidak cocok.');
      return;
    }

    setMenyimpanAdmin(true);
    try {
      const res = await api.post('/students/admin', {
        nim: formAdmin.nim.trim(),
        email: formAdmin.email.trim(),
        password: formAdmin.password,
      });
      setNotice(res.data.message || 'Akun administrator berhasil dibuat.');
      setAdminTerbuka(false);
      setFormAdmin({ nim: '', email: '', password: '', konfirmasi: '' });
      await fetchStudents();
    } catch (err) {
      setGalatAdmin(await pesanKesalahan(err, 'Gagal menambah akun administrator.'));
    } finally {
      setMenyimpanAdmin(false);
    }
  };

  // ---------------- Modal kelola ----------------

  const bukaKelola = (s: Student) => {
    setKelola(s);
    setTglPerpanjangan(keTanggalInput(s.diperpanjangSampai ?? s.perpanjanganHingga));
    setTglTenggat(keTanggalInput(s.tenggatHapus));
    setAktifkan(!s.isActive);
    setGalatKelola('');
  };

  const simpanKelola = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelola) return;

    setMenyimpanKelola(true);
    setGalatKelola('');
    try {
      const res = await api.patch(`/students/${kelola.id}/perpanjangan`, {
        perpanjanganHingga: tglPerpanjangan,
        tenggatHapus: tglTenggat,
        ...(aktifkan ? { aktifkan: true } : {}),
      });
      setNotice(res.data.message || 'Pengaturan akun diperbarui.');
      setKelola(null);
      await fetchStudents();
    } catch (err) {
      setGalatKelola(await pesanKesalahan(err, 'Gagal menyimpan pengaturan akun.'));
    } finally {
      setMenyimpanKelola(false);
    }
  };

  // ---------------- Impor PDF ----------------

  const resetImpor = () => {
    setBerkas(null);
    setPratinjau(null);
    setHasilImpor(null);
    setGalatImpor('');
  };

  const pratinjauImpor = async () => {
    if (!berkas) {
      setGalatImpor('Pilih berkas PDF terlebih dahulu.');
      return;
    }

    setMemuatPratinjau(true);
    setGalatImpor('');
    setPratinjau(null);
    setHasilImpor(null);
    try {
      const form = new FormData();
      form.append('file', berkas);
      const res = await api.post('/students/import/pratinjau', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPratinjau(res.data.data);
    } catch (err) {
      setGalatImpor(await pesanKesalahan(err, 'Gagal membaca berkas PDF.'));
    } finally {
      setMemuatPratinjau(false);
    }
  };

  const simpanImpor = async () => {
    if (!berkas) return;
    if (!window.confirm('Buat akun untuk semua baris yang siap diimpor? Password awal setiap akun sama dengan NIM.')) return;

    setMenyimpanImpor(true);
    setGalatImpor('');
    try {
      const form = new FormData();
      form.append('file', berkas);
      const res = await api.post('/students/import/simpan', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHasilImpor(res.data.data);
      setPratinjau(null);
      setNotice(res.data.message || 'Impor selesai.');
      await fetchStudents();
    } catch (err) {
      setGalatImpor(await pesanKesalahan(err, 'Gagal menyimpan hasil impor.'));
    } finally {
      setMenyimpanImpor(false);
    }
  };

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">

      {/* Header Halaman & Form Pencarian */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Data Mahasiswa</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total {meta?.total || 0} akun terdaftar di sistem.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Cari NIM atau Nama..."
                className="block w-full py-2 pr-3 text-sm text-gray-900 border border-gray-300 rounded-lg pl-9 bg-white dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500 focus:ring-amber-300 focus:border-amber-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
            >
              Cari
            </button>
          </form>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => { resetImpor(); setImporTerbuka(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 transition rounded-lg bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40"
              >
                <Upload className="w-4 h-4" /> Impor PDF
              </button>
              <button
                type="button"
                onClick={bukaTambah}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500"
              >
                <UserPlus className="w-4 h-4" /> Tambah
              </button>
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={bukaTambahAdmin}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-purple-700 transition rounded-lg bg-purple-50 hover:bg-purple-100 dark:text-purple-300 dark:bg-purple-950/60 dark:hover:bg-purple-900/40"
                >
                  <ShieldCheck className="w-4 h-4" /> Tambah Admin
                </button>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-600 transition rounded-lg bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Ekspor CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Status & Role */}
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Status
          <select
            value={status}
            onChange={(e) => ubahFilter(() => setStatus(e.target.value))}
            className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Role
          <select
            value={role}
            onChange={(e) => ubahFilter(() => setRole(e.target.value))}
            className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
          >
            <option value="ALL">Semua Role</option>
            {opsiFilterRole.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Pesan Error / Notifikasi */}
      {error && (
        <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">
          <FileSpreadsheet className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Tabel Data Mahasiswa */}
      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                <th className="p-4 font-medium">NIM</th>
                <th className="p-4 font-medium">Nama Mahasiswa</th>
                <th className="p-4 font-medium">Program Studi</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium text-center">Status Akun</th>
                {isAdmin && <th className="p-4 font-medium text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data mahasiswa ditemukan.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{student.nim}</td>
                    <td className="p-4 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          userId={student.id}
                          nama={student.profile?.nama || student.nim}
                          foto={student.foto ?? student.profile?.foto ?? null}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate dark:text-gray-100">{student.profile?.nama ?? '-'}</p>
                          {student.jabatan && (
                            <span className="block text-xs text-gray-400 dark:text-gray-500">
                              {student.jabatan}{student.organisasi ? ` — ${student.organisasi}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{student.profile?.program_studi ?? '-'}</td>
                    <td className="p-4">
                      {bolehUbahRole(student) ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={student.role}
                            disabled={sedangProses === student.id}
                            onChange={(e) => ubahRole(student, e.target.value)}
                            className="px-2 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300 disabled:opacity-50"
                          >
                            {(opsiRoleBaru.includes(student.role) ? opsiRoleBaru : [student.role, ...opsiRoleBaru]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                            ))}
                          </select>
                          {sedangProses === student.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                        </div>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">{ROLE_LABEL[student.role] ?? student.role}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => ubahStatus(student)}
                        disabled={sedangProses === student.id || student.id === user?.id}
                        title={student.id === user?.id ? 'Status akun sendiri tidak dapat diubah dari sini' : 'Klik untuk mengubah status'}
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full transition disabled:cursor-not-allowed ${
                          student.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60'
                        }`}
                      >
                        {student.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => bukaKelola(student)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Kelola
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {meta.page} dari {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page === 1}
                className="p-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page === meta.totalPages}
                className="p-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL KELOLA AKUN */}
      {kelola && (
        <div role="dialog" aria-modal="true" aria-label="Kelola mahasiswa" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setKelola(null)}>
          <form
            onSubmit={simpanKelola}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800 overflow-hidden"
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
                className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={menyimpanKelola}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
              >
                {menyimpanKelola ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL IMPOR PDF */}
      {adminTerbuka && (
        <div role="dialog" aria-modal="true" aria-label="Tambah administrator" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setAdminTerbuka(false)}>
          <form
            onSubmit={simpanAdmin}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                  <ShieldCheck className="w-5 h-5 text-purple-400" /> Tambah Akun Admin
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Administrator bisa mengelola mahasiswa, organisasi, dan konten. Hanya SUPERADMIN yang dapat membuat akun ini.
                </p>
              </div>
              <button type="button" onClick={() => setAdminTerbuka(false)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {galatAdmin && (
                <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatAdmin}
                </div>
              )}

              <div>
                <label htmlFor="admin-username" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input
                  id="admin-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9._-]{3,40}"
                  placeholder="Contoh: admin.fakultas"
                  value={formAdmin.nim}
                  onChange={(e) => setFormAdmin((f) => ({ ...f, nim: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai untuk login. Huruf, angka, titik, garis bawah, atau strip (3–40 karakter).</p>
              </div>

              <div>
                <label htmlFor="admin-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="admin@domain.com"
                  value={formAdmin.email}
                  onChange={(e) => setFormAdmin((f) => ({ ...f, email: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai untuk fitur lupa password. Harus unik.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password awal</label>
                  <input
                    id="admin-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formAdmin.password}
                    onChange={(e) => setFormAdmin((f) => ({ ...f, password: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
                <div>
                  <label htmlFor="admin-konfirmasi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Ulangi password</label>
                  <input
                    id="admin-konfirmasi"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formAdmin.konfirmasi}
                    onChange={(e) => setFormAdmin((f) => ({ ...f, konfirmasi: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Password minimal 8 karakter. Sampaikan password awal kepada admin tersebut; ia bisa menggantinya lewat halaman Profil.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setAdminTerbuka(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={menyimpanAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {menyimpanAdmin && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Admin
              </button>
            </div>
          </form>
        </div>
      )}

      {tambahTerbuka && (
        <div role="dialog" aria-modal="true" aria-label="Tambah mahasiswa" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm" onClick={() => setTambahTerbuka(false)}>
          <form
            onSubmit={simpanTambah}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                  <UserPlus className="w-5 h-5 text-amber-400" /> Tambah Mahasiswa
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Akun dibuat satu per satu. Password awal sama dengan NIM dan wajib diganti saat login pertama.
                </p>
              </div>
              <button type="button" onClick={() => setTambahTerbuka(false)} className="p-1 text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {galatTambah && (
                <div className="flex items-start gap-2 p-3 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {galatTambah}
                </div>
              )}

              <div>
                <label htmlFor="tambah-nim" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">NIM</label>
                <input
                  id="tambah-nim"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="\d{8}[A-Za-z]?"
                  placeholder="Contoh: 22140001"
                  value={formTambah.nim}
                  onChange={(e) => setFormTambah((f) => ({ ...f, nim: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">8 digit angka, boleh diakhiri satu huruf.</p>
              </div>

              <div>
                <label htmlFor="tambah-nama" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                <input
                  id="tambah-nama"
                  type="text"
                  required
                  value={formTambah.nama}
                  onChange={(e) => setFormTambah((f) => ({ ...f, nama: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                />
              </div>

              <div>
                <label htmlFor="tambah-prodi" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Program Studi</label>
                <select
                  id="tambah-prodi"
                  value={formTambah.program_studi}
                  onChange={(e) => setFormTambah((f) => ({ ...f, program_studi: e.target.value }))}
                  className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                >
                  {PROGRAM_STUDI.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="tambah-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email (opsional)</label>
                  <input
                    id="tambah-email"
                    type="email"
                    value={formTambah.email}
                    onChange={(e) => setFormTambah((f) => ({ ...f, email: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
                <div>
                  <label htmlFor="tambah-hp" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">No. HP/WA (opsional)</label>
                  <input
                    id="tambah-hp"
                    type="tel"
                    value={formTambah.no_hp}
                    onChange={(e) => setFormTambah((f) => ({ ...f, no_hp: e.target.value }))}
                    className="w-full p-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 focus:ring-amber-300 focus:border-amber-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setTambahTerbuka(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={menyimpanTambah}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
              >
                {menyimpanTambah && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {imporTerbuka && (
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
                >
                  {memuatPratinjau ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Pratinjau PDF
                </button>

                {pratinjau && pratinjau.siapDiimpor > 0 && (
                  <button
                    type="button"
                    onClick={simpanImpor}
                    disabled={menyimpanImpor}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50"
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
                <div className="p-4 space-y-2 text-sm rounded-lg bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-200">
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
                className="px-4 py-2 text-sm font-bold text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
