import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/axios';
import { Search, FileSpreadsheet, Trash2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useProfileDialog } from '../contexts/ProfileDialogContext';
import {
  ASSIGNABLE_ROLES, ROLE_ADMIN, ROLE_LABEL, ROLE_SUPERADMIN, isAdminRole,
} from '../lib/roles';
import {
  FORM_TAMBAH_KOSONG, LIMIT, PROGRAM_STUDI,
  keTanggalInput,
  type FormAdmin, type FormAkun, type FormTambah, type HasilPratinjau,
  type HasilSimpan, type Meta, type Student, type StudentSampah, type TabData,
} from './students/data-mahasiswa';
import HeaderHalaman from './students/HeaderHalaman';
import BilahFilter from './students/BilahFilter';
import RingkasanAngkatan from './students/RingkasanAngkatan';
import BilahAksiMassal from './students/BilahAksiMassal';
import TabelMahasiswa from './students/TabelMahasiswa';
import TabelSampah from './students/TabelSampah';
import ModalSunting from './students/ModalSunting';
import ModalKelola from './students/ModalKelola';
import ModalAdmin from './students/ModalAdmin';
import ModalTambah from './students/ModalTambah';
import ModalImpor from './students/ModalImpor';

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

export default function Students() {
  const { user } = useAuth();
  const { bukaProfil } = useProfileDialog();
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
  // null = semua angkatan. Diisi dengan tahun (mis. 2022) saat kartu diklik.
  const [angkatan, setAngkatan] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sedangProses, setSedangProses] = useState<string | null>(null);

  // --- Aksi massal & tempat sampah ---
  const [tab, setTab] = useState<TabData>('AKTIF');
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRole, setBulkRole] = useState('MAHASISWA');
  const [sampah, setSampah] = useState<StudentSampah[]>([]);
  const [memuatSampah, setMemuatSampah] = useState(false);
  const [sampahTotal, setSampahTotal] = useState(0);
  const [sampahHalaman, setSampahHalaman] = useState(1);
  const [sampahTotalHalaman, setSampahTotalHalaman] = useState(0);

  // --- Modal sunting data mahasiswa (admin & superadmin) ---
  const [edit, setEdit] = useState<Student | null>(null);
  const [formEdit, setFormEdit] = useState<FormAkun>({
    nama: '',
    program_studi: PROGRAM_STUDI[0] as string,
    email: '',
    no_hp: '',
  });
  const [menyimpanEdit, setMenyimpanEdit] = useState(false);
  const [galatEdit, setGalatEdit] = useState('');

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
  const [formAdmin, setFormAdmin] = useState<FormAdmin>({ nim: '', email: '', password: '', konfirmasi: '' });
  const [menyimpanAdmin, setMenyimpanAdmin] = useState(false);
  const [galatAdmin, setGalatAdmin] = useState('');

  // --- Modal tambah mahasiswa manual (satu per satu) ---
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [formTambah, setFormTambah] = useState<FormTambah>({ ...FORM_TAMBAH_KOSONG });
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

  // Controller di ref: muat ulang pasca-mutasi (panggil tanpa argumen) tetap bisa dibatalkan, bukan hanya fetch dari useEffect.
  const pembatalAktif = useRef<AbortController | null>(null);
  const pembatalSampah = useRef<AbortController | null>(null);

  const fetchStudents = useCallback(async () => {
    pembatalAktif.current?.abort();
    const controller = new AbortController();
    pembatalAktif.current = controller;
    setLoading(true);
    setError('');
    // Balasan yang dibatalkan bukan kegagalan: jangan tulis galat dan jangan
    // matikan spinner milik permintaan baru yang sudah berjalan.
    let batal = false;
    try {
      const response = await api.get('/students', {
        params: {
          page,
          limit: LIMIT,
          search: kataKunci || undefined,
          status: status === 'ALL' ? undefined : status,
          role: role === 'ALL' ? undefined : role,
          angkatan: angkatan ?? undefined,
        },
        signal: controller.signal,
      });
      setStudents(response.data.data);
      setMeta(response.data.meta);
      setDipilih(new Set());
    } catch (err) {
      if (axios.isCancel(err)) batal = true;
      else setError(await pesanKesalahan(err, 'Gagal memuat data mahasiswa'));
    } finally {
      if (pembatalAktif.current === controller) pembatalAktif.current = null;
      if (!batal) setLoading(false);
    }
  }, [page, kataKunci, status, role, angkatan]);

  const fetchSampah = useCallback(async () => {
    pembatalSampah.current?.abort();
    const controller = new AbortController();
    pembatalSampah.current = controller;
    setMemuatSampah(true);
    setError('');
    let batal = false;
    try {
      const res = await api.get('/students/trash', {
        params: { search: kataKunci || undefined, page: sampahHalaman, limit: 20 },
        signal: controller.signal,
      });
      setSampah(res.data.data);
      setSampahTotal(res.data.meta?.total || 0);
      setSampahTotalHalaman(res.data.meta?.totalPages || 0);
    } catch (err) {
      if (axios.isCancel(err)) batal = true;
      else setError(await pesanKesalahan(err, 'Gagal memuat tempat sampah.'));
    } finally {
      if (pembatalSampah.current === controller) pembatalSampah.current = null;
      if (!batal) setMemuatSampah(false);
    }
  }, [kataKunci, sampahHalaman]);

  useEffect(() => {
    if (tab !== 'AKTIF') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStudents();
    return () => { pembatalAktif.current?.abort(); };
  }, [fetchStudents, tab]);

  useEffect(() => {
    if (tab !== 'SAMPAH') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSampah();
    return () => { pembatalSampah.current?.abort(); };
  }, [fetchSampah, tab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSampahHalaman(1);
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

  // ---------------- Sunting & hapus akun ----------------

  /** Hanya superadmin, dan bukan akun sendiri/pengelola, yang boleh dihapus. */
  const bolehHapus = (s: Student): boolean =>
    isSuperadmin && s.id !== user?.id && s.role !== ROLE_SUPERADMIN && s.role !== ROLE_ADMIN;

  const bukaEdit = (s: Student) => {
    const prodiSaatIni = s.profile?.program_studi ?? PROGRAM_STUDI[0];
    setEdit(s);
    setFormEdit({
      nama: s.profile?.nama ?? '',
      program_studi: prodiSaatIni,
      // Akun ADMIN tidak punya profil; emailnya diambil dari akun (kolom User).
      email: s.profile?.email ?? s.email ?? '',
      no_hp: s.profile?.no_hp ?? '',
    });
    setGalatEdit('');
  };

  const simpanEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;

    setMenyimpanEdit(true);
    setGalatEdit('');
    try {
      const body = edit.profile
        ? {
            nama: formEdit.nama.trim(),
            program_studi: formEdit.program_studi,
            email: formEdit.email.trim(),
            no_hp: formEdit.no_hp.trim(),
          }
        : { email: formEdit.email.trim() };

      const res = await api.put(`/students/${edit.id}`, body);
      setNotice(res.data.message || 'Data akun diperbarui.');
      setEdit(null);
      await fetchStudents();
    } catch (err) {
      setGalatEdit(await pesanKesalahan(err, 'Gagal menyimpan perubahan.'));
    } finally {
      setMenyimpanEdit(false);
    }
  };

  const hapusStudent = async (s: Student) => {
    const nama = s.profile?.nama || s.nim;
    const yakin = window.confirm(
      `Pindahkan akun ${nama} (${s.nim}) ke Tempat Sampah?\n\n` +
        'Akun langsung tidak bisa login dan hilang dari daftar, tetapi masih bisa dipulihkan dalam 30 hari. ' +
        'Penghapusan permanen hanya dilakukan dari tab Tempat Sampah.'
    );
    if (!yakin) return;

    setSedangProses(s.id);
    setError('');
    setNotice('');
    try {
      const res = await api.delete(`/students/${s.id}`);
      setNotice(res.data.message || 'Akun dipindahkan ke Tempat Sampah.');
      // Bila baris terakhir di halaman ini terhapus, mundur satu halaman.
      if (students.length === 1 && page > 1) setPage((p) => p - 1);
      else await fetchStudents();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal menghapus akun.'));
    } finally {
      setSedangProses(null);
    }
  };

  // ---------------- Aksi massal & tempat sampah ----------------

  const togglePilih = (id: string) => {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  };

  const semuaTerpilih = students.length > 0 && students.every((s) => dipilih.has(s.id));

  const toggleSemua = () => {
    setDipilih(semuaTerpilih ? new Set() : new Set(students.map((s) => s.id)));
  };

  const jalankanBulk = async (action: string, role?: string) => {
    const ids = [...dipilih];
    if (ids.length === 0) return;

    const label: Record<string, string> = {
      AKTIFKAN: 'mengaktifkan',
      NONAKTIFKAN: 'menonaktifkan',
      PUTUS_PERANGKAT: 'memutus semua perangkat',
      UBAH_ROLE: `mengubah role menjadi ${ROLE_LABEL[role || ''] || role}`,
      HAPUS: 'memindahkan ke Tempat Sampah',
    };
    if (!window.confirm(`Yakin ${label[action] || action} ${ids.length} akun terpilih?`)) return;

    setBulkBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.patch('/students/bulk', { ids, action, role });
      setNotice(res.data.message || 'Aksi massal selesai.');
      setDipilih(new Set());
      await fetchStudents();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal menjalankan aksi massal.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const pulihkanSiswa = async (s: StudentSampah) => {
    if (!window.confirm(`Pulihkan akun ${s.profile?.nama || s.nim} (${s.nim})?`)) return;
    setSedangProses(s.id);
    try {
      const res = await api.put(`/students/${s.id}/restore`);
      setNotice(res.data.message || 'Akun dipulihkan.');
      await fetchSampah();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal memulihkan akun.'));
    } finally {
      setSedangProses(null);
    }
  };

  const hapusPermanen = async (s: StudentSampah) => {
    const nama = s.profile?.nama || s.nim;
    if (
      !window.confirm(
        `Hapus PERMANEN akun ${nama} (${s.nim})?\n\n` +
          'Tiket, jabatan, komentar, perangkat, dan profil miliknya ikut terhapus. Tindakan ini tidak dapat dibatalkan.'
      )
    )
      return;

    setSedangProses(s.id);
    try {
      const res = await api.delete(`/students/${s.id}/permanent`);
      setNotice(res.data.message || 'Akun dihapus permanen.');
      await fetchSampah();
    } catch (err) {
      setError(await pesanKesalahan(err, 'Gagal menghapus permanen.'));
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

  const tombolTab = isAdmin ? (
    <div className="inline-flex p-1 border border-gray-200 rounded-xl bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
      <button
        type="button"
        onClick={() => { setTab('AKTIF'); setDipilih(new Set()); }}
        aria-pressed={tab === 'AKTIF'}
        className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${tab === 'AKTIF' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
      >
        Data Aktif
      </button>
      {isSuperadmin && (
        <button
          type="button"
          onClick={() => setTab('SAMPAH')}
          aria-pressed={tab === 'SAMPAH'}
          className={`px-3 py-1.5 text-sm font-bold rounded-lg transition ${tab === 'SAMPAH' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Tempat Sampah {sampahTotal > 0 && <span className="ml-1 text-xs text-amber-600 dark:text-amber-300">({sampahTotal})</span>}
        </button>
      )}
    </div>
  ) : null;

  if (tab === 'SAMPAH') {
    return (
      <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
              <Trash2 className="w-6 h-6 text-amber-500" /> Tempat Sampah Mahasiswa
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sampahTotal} akun menunggu pemulihan atau penghapusan permanen. Akun dihapus otomatis setelah 30 hari.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tombolTab}
            <button
              type="button"
              onClick={() => fetchSampah()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${memuatSampah ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute w-4 h-4 text-gray-400 left-3 top-3" />
            <input
              type="text"
              placeholder="Cari NIM atau nama di tempat sampah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2 pl-9 pr-3 text-base sm:text-sm text-gray-900 bg-white border border-gray-300 rounded-lg dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm font-bold text-gray-900 rounded-lg bg-amber-400 hover:bg-amber-500">
            Cari
          </button>
        </form>

        {error && <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>}
        {notice && <div className="p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">{notice}</div>}

        <TabelSampah
          sampah={sampah}
          memuatSampah={memuatSampah}
          sedangProses={sedangProses}
          halaman={sampahHalaman}
          totalHalaman={sampahTotalHalaman}
          setHalaman={setSampahHalaman}
          pulihkanSiswa={pulihkanSiswa}
          hapusPermanen={hapusPermanen}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl p-6 mx-auto space-y-6 md:p-8">

      <HeaderHalaman
        meta={meta}
        angkatan={angkatan}
        search={search}
        setSearch={setSearch}
        handleSearch={handleSearch}
        isAdmin={isAdmin}
        isSuperadmin={isSuperadmin}
        exporting={exporting}
        handleExportCsv={handleExportCsv}
        bukaTambah={bukaTambah}
        bukaTambahAdmin={bukaTambahAdmin}
        bukaImpor={() => { resetImpor(); setImporTerbuka(true); }}
      />

      {tombolTab && <div>{tombolTab}</div>}

      <BilahFilter
        isAdmin={isAdmin}
        status={status}
        setStatus={setStatus}
        role={role}
        setRole={setRole}
        opsiFilterRole={opsiFilterRole}
        angkatan={angkatan}
        setAngkatan={setAngkatan}
        ubahFilter={ubahFilter}
      />

      {/* Ringkasan jumlah mahasiswa per angkatan (ADMIN & SUPERADMIN). */}
      {isAdmin && meta?.perAngkatan && meta.perAngkatan.length > 0 && (
        <RingkasanAngkatan
          meta={meta}
          angkatan={angkatan}
          setAngkatan={setAngkatan}
          ubahFilter={ubahFilter}
        />
      )}

      {/* Pesan Error / Notifikasi */}
      {error && (
        <div className="p-4 text-sm text-red-600 rounded-lg bg-red-50 dark:bg-red-950/60 dark:text-red-300">{error}</div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-700 rounded-lg bg-green-50 dark:bg-green-950/60 dark:text-green-300">
          <FileSpreadsheet className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Bilah aksi massal */}
      {isAdmin && dipilih.size > 0 && (
        <BilahAksiMassal
          jumlah={dipilih.size}
          bulkBusy={bulkBusy}
          bulkRole={bulkRole}
          setBulkRole={setBulkRole}
          isSuperadmin={isSuperadmin}
          opsiRoleBaru={opsiRoleBaru}
          jalankanBulk={jalankanBulk}
          setDipilih={setDipilih}
        />
      )}

      {/* Tabel Data Mahasiswa */}
      <TabelMahasiswa
        students={students}
        meta={meta}
        loading={loading}
        isAdmin={isAdmin}
        idAkunSendiri={user?.id}
        dipilih={dipilih}
        semuaTerpilih={semuaTerpilih}
        sedangProses={sedangProses}
        opsiRoleBaru={opsiRoleBaru}
        toggleSemua={toggleSemua}
        togglePilih={togglePilih}
        bukaProfil={bukaProfil}
        ubahRole={ubahRole}
        ubahStatus={ubahStatus}
        bolehUbahRole={bolehUbahRole}
        bolehHapus={bolehHapus}
        bukaKelola={bukaKelola}
        bukaEdit={bukaEdit}
        hapusStudent={hapusStudent}
        setPage={setPage}
      />

      {/* MODAL SUNTING DATA AKUN */}
      {edit && (
        <ModalSunting
          edit={edit}
          setEdit={setEdit}
          formEdit={formEdit}
          setFormEdit={setFormEdit}
          galatEdit={galatEdit}
          menyimpanEdit={menyimpanEdit}
          simpanEdit={simpanEdit}
        />
      )}

      {/* MODAL KELOLA AKUN */}
      {kelola && (
        <ModalKelola
          kelola={kelola}
          setKelola={setKelola}
          tglPerpanjangan={tglPerpanjangan}
          setTglPerpanjangan={setTglPerpanjangan}
          tglTenggat={tglTenggat}
          setTglTenggat={setTglTenggat}
          aktifkan={aktifkan}
          setAktifkan={setAktifkan}
          batasTanggal={batasTanggal}
          galatKelola={galatKelola}
          menyimpanKelola={menyimpanKelola}
          simpanKelola={simpanKelola}
        />
      )}

      {/* MODAL TAMBAH AKUN ADMIN */}
      {adminTerbuka && (
        <ModalAdmin
          setAdminTerbuka={setAdminTerbuka}
          formAdmin={formAdmin}
          setFormAdmin={setFormAdmin}
          galatAdmin={galatAdmin}
          menyimpanAdmin={menyimpanAdmin}
          simpanAdmin={simpanAdmin}
        />
      )}

      {/* MODAL TAMBAH MAHASISWA */}
      {tambahTerbuka && (
        <ModalTambah
          setTambahTerbuka={setTambahTerbuka}
          formTambah={formTambah}
          setFormTambah={setFormTambah}
          galatTambah={galatTambah}
          menyimpanTambah={menyimpanTambah}
          simpanTambah={simpanTambah}
        />
      )}

      {/* MODAL IMPOR PDF */}
      {imporTerbuka && (
        <ModalImpor
          setImporTerbuka={setImporTerbuka}
          berkas={berkas}
          setBerkas={setBerkas}
          pratinjau={pratinjau}
          setPratinjau={setPratinjau}
          hasilImpor={hasilImpor}
          setHasilImpor={setHasilImpor}
          galatImpor={galatImpor}
          setGalatImpor={setGalatImpor}
          memuatPratinjau={memuatPratinjau}
          menyimpanImpor={menyimpanImpor}
          pratinjauImpor={pratinjauImpor}
          simpanImpor={simpanImpor}
        />
      )}
    </div>
  );
}
