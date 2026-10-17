import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert, Loader2, Mail, Phone, Camera, X } from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function FirstLogin() {
  const [email, setEmail] = useState('');
  const [noHp, setNoHp] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi cepat di sisi klien supaya pengguna dapat umpan balik langsung
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format foto tidak didukung. Gunakan JPG, PNG, atau WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran foto maksimal 2 MB.');
      return;
    }

    setError('');
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi di sisi Frontend
    if (!email.trim()) {
      setError('Email wajib diisi.');
      return;
    }
    if (noHp.trim().length < 10) {
      setError('Nomor HP/WA wajib diisi, minimal 10 digit.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal harus 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (newPassword === user?.nim) {
      setError('Password baru tidak boleh sama dengan NIM Anda.');
      return;
    }

    setIsLoading(true);

    try {
      // Endpoint first-login memakai multipart/form-data karena foto bersifat opsional
      const formData = new FormData();
      formData.append('email', email.trim());
      formData.append('no_hp', noHp.trim());
      formData.append('password_baru', newPassword);
      formData.append('konfirmasi_password', confirmPassword);
      if (photo) formData.append('foto', photo);

      const res = await api.post('/auth/first-login', formData);

      // Update global context agar status first_login menjadi false
      if (res.data?.user) {
        login(res.data.user);
      } else if (user) {
        login({ ...user, first_login: false });
      }

      // Email belum terbukti benar, jadi pengguna diarahkan memverifikasi dulu
      navigate('/verify-email');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal menyimpan data Anda.');
      } else {
        setError('Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 space-y-6 border-t-4 border-yellow-500">
        <div className="text-center">
          <div className="mx-auto bg-yellow-100 dark:bg-yellow-900/40 w-12 h-12 flex items-center justify-center rounded-full mb-4">
            <ShieldAlert className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Amankan Akun Anda</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Ini adalah pertama kalinya Anda login. Demi keamanan, Anda <b>diwajibkan</b> mengubah password bawaan (NIM) sekaligus melengkapi <b>email</b> dan <b>nomor HP/WA</b> Anda sebelum melanjutkan.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="nama@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. HP / WhatsApp</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="tel"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="08xxxxxxxxxx"
                value={noHp}
                onChange={(e) => setNoHp(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Foto Profil <span className="font-normal text-gray-400 dark:text-gray-500">(opsional)</span>
            </label>
            {photoPreview ? (
              <div className="flex items-center gap-4">
                <img
                  src={photoPreview}
                  alt="Pratinjau foto profil"
                  className="object-cover w-16 h-16 border border-gray-200 dark:border-gray-800 rounded-full"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <X className="w-3.5 h-3.5" /> Hapus foto
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full gap-2 px-3 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 transition border border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Camera className="w-4 h-4" /> Pilih foto (JPG/PNG/WEBP, maks 2 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konfirmasi Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Ketik ulang password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Simpan & Lanjutkan'}
          </button>
        </form>
      </div>
    </div>
  );
}