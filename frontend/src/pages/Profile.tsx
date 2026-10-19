import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, assetUrl } from '../lib/axios';
import {
  UserCircle, ShieldCheck, BookOpen, Loader2, Mail, Pencil, Save, X, Check,
  Phone, Hash, CalendarDays, Briefcase, Camera, BadgeCheck, AlertTriangle, Upload
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABEL } from '../lib/roles';
import PasswordInput from '../components/PasswordInput';

interface Jabatan {
  id: string;
  title: string;
  organisasi: string;
  divisi: string | null;
  startDate: string;
}

interface ProfileData {
  id: string;
  nim: string;
  role: string;
  isActive: boolean;
  angkatan: number | null;
  foto: string | null;
  deactivatedAt: string | null;
  deactivationType: string | null;
  createdAt: string;
  email_verified: boolean;
  // Email akun (kolom User.email) — dipakai akun tanpa profil seperti admin.
  email: string | null;
  profile: {
    nama: string;
    nim: string;
    program_studi: string;
    email: string | null;
    no_hp: string | null;
    foto: string | null;
    email_verified?: boolean;
  } | null;
  jabatan: Jabatan[];
}

export default function Profile() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State untuk pengubahan email pribadi
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailErr, setEmailErr] = useState('');

  // State untuk unggah foto profil
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [photoErr, setPhotoErr] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // State untuk ganti password (berlaku untuk SEMUA role)
  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile/me');
      setData(response.data);
      setEmailInput(response.data.profile?.email || '');
    } catch {
      setError('Gagal memuat data profil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile();
  }, []);

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(''); setEmailErr('');
    setSavingEmail(true);
    try {
      const res = await api.put('/profile/me', { email: emailInput });
      setEmailMsg(res.data.message || 'Email berhasil diperbarui.');
      setIsEditingEmail(false);

      // Segarkan status global supaya penjaga rute (verifikasi email) ikut tahu.
      const me = await api.get('/auth/me');
      login(me.data.user);

      // Hanya akun yang punya profil yang perlu verifikasi email. Admin hanya
      // menyimpan email akun untuk keperluan lupa password.
      if (res.data.emailBerubah && data?.profile) {
        navigate('/verify-email');
        return;
      }
      fetchProfile();
    } catch (err) {
      if (axios.isAxiosError(err)) setEmailErr(err.response?.data?.message || 'Gagal menyimpan email.');
      else setEmailErr('Terjadi kesalahan yang tidak terduga.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (passwordBaru.length < 8) {
      setPasswordErr('Password baru minimal 8 karakter.');
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setPasswordErr('Konfirmasi password tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.post('/auth/change-password', {
        password_lama: passwordLama,
        password_baru: passwordBaru,
        konfirmasi_password: konfirmasiPassword,
      });
      setPasswordMsg(res.data.message || 'Password berhasil diganti.');
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
    } catch (err) {
      if (axios.isAxiosError(err)) setPasswordErr(err.response?.data?.message || 'Gagal mengganti password.');
      else setPasswordErr('Terjadi kesalahan yang tidak terduga.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoMsg(''); setPhotoErr('');

    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setPhotoErr('Berkas harus berupa gambar (JPG, PNG, WEBP, HEIC, dst.; bukan SVG).');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoErr('Ukuran foto maksimal 2 MB.');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('foto', file);

    setUploadingPhoto(true);
    try {
      const res = await api.post('/profile/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setData((prev) => (prev ? { ...prev, foto: res.data.foto } : prev));
      setPhotoMsg(res.data.message || 'Foto profil berhasil diperbarui.');

      // Sinkronkan avatar di header dashboard & landing.
      const me = await api.get('/auth/me');
      login(me.data.user);
    } catch (err) {
      if (axios.isAxiosError(err)) setPhotoErr(err.response?.data?.message || 'Gagal mengunggah foto.');
      else setPhotoErr('Terjadi kesalahan yang tidak terduga.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>;
  }

  if (error || !data) {
    return <div className="p-4 m-6 text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60">{error}</div>;
  }

  const nama = data.profile?.nama || 'Administrator Sistem';
  const inisial = nama.substring(0, 2).toUpperCase();
  // Akun admin/superadmin tidak punya profil, jadi emailnya ada di data.email.
  const emailAktif = data.profile?.email ?? data.email ?? null;

  const biodata = [
    { label: 'Nomor Induk Mahasiswa (NIM)', value: data.nim, icon: Hash },
    { label: 'Nama Lengkap', value: data.profile?.nama || '-', icon: UserCircle },
    { label: 'Program Studi', value: data.profile?.program_studi || '-', icon: BookOpen },
    { label: 'Tahun Angkatan', value: data.angkatan ? String(data.angkatan) : '-', icon: CalendarDays },
    { label: 'No. HP / WhatsApp', value: data.profile?.no_hp || 'Belum diisi', icon: Phone },
    { label: 'Email Pribadi', value: data.profile?.email || 'Belum ada email', icon: Mail },
  ];

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6 md:p-8">
      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
        {/* Header Profil */}
        <div className="flex flex-col items-center gap-6 px-8 py-10 text-white sm:flex-row sm:items-center bg-gradient-to-r from-amber-400 to-orange-400">
          {/* Foto profil + tombol unggah */}
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-28 h-28 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm ring-4 ring-white/30">
              {data.foto ? (
                <img src={assetUrl(data.foto)} alt={nama} className="object-cover w-full h-full" />
              ) : (
                <span className="text-3xl font-black text-white">{inisial}</span>
              )}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Ganti foto profil"
              className="absolute bottom-0 right-0 flex items-center justify-center w-9 h-9 text-amber-600 dark:text-amber-300 bg-white dark:bg-gray-900 rounded-full shadow-lg hover:bg-amber-50 dark:hover:bg-amber-950/60 disabled:opacity-60"
            >
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold sm:text-3xl">{nama}</h1>
            <p className="flex items-center justify-center gap-2 mt-1 text-amber-100 sm:justify-start">
              <ShieldCheck className="w-4 h-4" />
              Hak Akses: {ROLE_LABEL[data.role] || data.role}
            </p>
            {data.jabatan.length > 0 && (
              <p className="flex items-center justify-center gap-2 mt-1 text-sm text-white/90 sm:justify-start">
                <Briefcase className="w-4 h-4" />
                {data.jabatan.map((j) => `${j.title} ${j.organisasi}`).join(' • ')}
              </p>
            )}
          </div>
        </div>

        <div className="px-8 py-4 space-y-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
          {photoMsg && (
            <div className="flex items-center gap-2 p-3 text-sm font-bold text-green-800 dark:text-green-300 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-4 h-4" /> {photoMsg}
            </div>
          )}
          {photoErr && (
            <div className="p-3 text-sm font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
              {photoErr}
            </div>
          )}
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Upload className="w-3.5 h-3.5" />
            Klik ikon kamera untuk menambahkan / mengganti foto profil (JPG, PNG, WEBP, HEIC — maksimal 2 MB, otomatis diubah ke WebP).
          </p>
        </div>

        {/* Informasi Detail */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-800 dark:text-gray-100">Biodata</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {biodata.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 break-all">{item.value}</p>
                  </div>
                </div>
              );
            })}

            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status Akun</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                data.isActive ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
              }`}>
                {data.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Terdaftar Sejak</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {new Date(data.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Peringatan akun nonaktif otomatis */}
          {!data.isActive && (
            <div className="flex items-start gap-3 p-4 mt-6 text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/60">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Akun ini sedang nonaktif
                  {data.deactivationType === 'AUTO' ? ' (otomatis karena masa studi 5 tahun).' : ' (dinonaktifkan manual oleh admin/pengurus).'}
                </p>
                <p>
                  Hubungi admin atau pengurus untuk mengaktifkan kembali akun Anda.
                  {data.deactivationType === 'AUTO' && ' Akun yang nonaktif otomatis selama 1 tahun akan dihapus permanen.'}
                </p>
              </div>
            </div>
          )}

          {/* Daftar jabatan aktif */}
          {data.jabatan.length > 0 && (
            <div className="pt-6 mt-8 border-t border-gray-100 dark:border-gray-800">
              <h3 className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-100">Jabatan Aktif</h3>
              <div className="space-y-3">
                {data.jabatan.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 p-3 border border-amber-100 dark:border-amber-900/60 rounded-lg bg-amber-50/50">
                    <Briefcase className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100">{j.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {j.organisasi}{j.divisi ? ` • ${j.divisi}` : ''} • sejak {new Date(j.startDate).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KARTU EMAIL PRIBADI */}
      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="flex items-center gap-3 px-8 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60">
            <Mail className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Email Pribadi</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {data.profile
                ? 'Dipakai untuk menerima notifikasi resmi. Harus diverifikasi agar notifikasi benar-benar sampai.'
                : 'Dipakai untuk menerima notifikasi dan memulihkan password akun pengelola.'}
            </p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {emailMsg && (
            <div className="flex items-center gap-2 p-3 text-sm font-bold text-green-800 dark:text-green-300 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-4 h-4" /> {emailMsg}
            </div>
          )}
          {emailErr && (
            <div className="p-3 text-sm font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
              {emailErr}
            </div>
          )}

          {!isEditingEmail ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Terdaftar</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-all">
                  {emailAktif || <span className="italic font-normal text-gray-400 dark:text-gray-500">Belum ada email</span>}
                </p>
                {emailAktif && data.profile ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 mt-1 text-xs font-bold rounded-full ${
                    data.profile.email_verified ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                  }`}>
                    <BadgeCheck className="w-3.5 h-3.5" />
                    {data.profile.email_verified ? 'Terverifikasi' : 'Belum diverifikasi'}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => { setEmailMsg(''); setEmailErr(''); setEmailInput(emailAktif || ''); setIsEditingEmail(true); }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 font-bold text-white transition rounded-lg bg-amber-400 hover:bg-amber-500 active:scale-95"
              >
                <Pencil className="w-4 h-4" /> Ubah Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="prof-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Baru</label>
                <input
                  id="prof-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="nama@contoh.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEditingEmail(false); setEmailErr(''); }}
                  className="inline-flex items-center gap-2 px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4" /> Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
                >
                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* KARTU KEAMANAN: GANTI PASSWORD (SEMUA ROLE) */}
      <div className="overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-xl">
        <div className="flex items-center gap-3 px-8 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Keamanan Akun</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ganti password Anda kapan saja. Berlaku untuk semua role, termasuk admin.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="p-8 space-y-4">
          {passwordMsg && (
            <div role="status" className="flex items-center gap-2 p-3 text-sm font-bold text-green-800 dark:text-green-300 bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="w-4 h-4" /> {passwordMsg}
            </div>
          )}
          {passwordErr && (
            <div role="alert" className="p-3 text-sm font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
              {passwordErr}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="prof-password-lama" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password Lama</label>
              <PasswordInput
                id="prof-password-lama"
                name="passwordLama"
                required
                autoComplete="current-password"
                spellCheck={false}
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-password-baru" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru</label>
              <PasswordInput
                id="prof-password-baru"
                name="passwordBaru"
                required
                minLength={8}
                autoComplete="new-password"
                spellCheck={false}
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="prof-password-konfirmasi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ulangi Password Baru</label>
              <PasswordInput
                id="prof-password-konfirmasi"
                name="konfirmasiPassword"
                required
                minLength={8}
                autoComplete="new-password"
                spellCheck={false}
                value={konfirmasiPassword}
                onChange={(e) => setKonfirmasiPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg outline-none bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-bold text-white rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Password Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
