import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Loader2, ArrowLeft, Info, AlertCircle } from 'lucide-react'; // Tambahan Info & AlertCircle
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';
import { ambilMaksudSetelahLogin, api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorPerangkat, setErrorPerangkat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorPerangkat(false);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { nim, password });
      const userData = response.data.user;
      
      login(userData);

      if (userData.first_login) {
        navigate('/first-login');
      } else if (userData.email && !userData.email_verified) {
        // Email ada tapi belum terbukti benar: tahan di halaman verifikasi
        navigate('/verify-email');
      } else {
        // Kembali ke halaman yang sedang dibuka waktu sesi mati, kalau ada.
        navigate(ambilMaksudSetelahLogin() || '/dashboard');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Gagal terhubung ke server');
        setErrorPerangkat(err.response?.data?.code === 'PERANGKAT_TERKUNCI');
      } else {
        setError('Terjadi kesalahan yang tidak terduga');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-950">
      {/* Ubah max-w-md menjadi max-w-4xl dan buat flex row untuk layout terbagi dua */}
      <div className="flex flex-col w-full max-w-4xl overflow-hidden bg-white shadow-xl md:flex-row rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
        
        {/* BAGIAN KIRI: Form Login */}
        <div className="relative w-full p-8 space-y-6 md:w-1/2">
          <ThemeToggle className="absolute top-4 right-4" />
          
          <div className="text-center md:mt-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">BEM-FT UNAYA</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">Portal Sistem Informasi Mahasiswa</p>
          </div>

          {error && (
            <div
              role="alert"
              className={`p-3 text-sm text-center rounded-lg ${
                errorPerangkat
                  ? 'text-amber-800 bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900/60'
                  : 'text-red-600 bg-red-50 dark:bg-red-950/60 dark:text-red-300'
              }`}
            >
              {errorPerangkat && <p className="mb-1 font-bold">Akun sedang dipakai di perangkat lain</p>}
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-nim" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">NIM / Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  id="login-nim"
                  name="nim"
                  type="text"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  className="block w-full py-2 pl-10 pr-3 text-gray-900 border border-gray-300 rounded-lg focus:ring-amber-400 focus:border-amber-400 bg-gray-50 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500"
                  placeholder="Masukkan NIM Anda"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <PasswordInput
                  id="login-password"
                  name="password"
                  required
                  autoComplete="current-password"
                  spellCheck={false}
                  className="block w-full py-2 pl-10 text-gray-900 border border-gray-300 rounded-lg focus:ring-amber-400 focus:border-amber-400 bg-gray-50 dark:text-gray-100 dark:border-gray-700 dark:bg-gray-800"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-gray-900 bg-amber-400 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-300 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk'}
            </button>

            <div className="text-right">
              <Link
                to="/lupa-password"
                className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
              >
                Lupa password?
              </Link>
            </div>
          </form>

          <div className="pt-2 text-center">
            <Link 
              to="/" 
              className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Halaman Utama
            </Link>
          </div>
        </div>

        {/* BAGIAN KANAN: Panduan Login & OTP */}
        <div className="flex flex-col justify-center w-full p-8 border-t border-gray-100 md:w-1/2 bg-amber-50/50 dark:bg-gray-800/30 md:border-t-0 md:border-l dark:border-gray-800">
          <div className="space-y-6">
            
            {/* Header Panduan */}
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                <Info className="w-6 h-6 text-amber-500" />
                Panduan Login Pertama
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Bagi mahasiswa yang baru pertama kali mengakses portal, silakan ikuti langkah berikut:
              </p>
            </div>

            {/* List Tata Cara */}
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">1</div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Gunakan <strong>NIM</strong> Anda sebagai Username dan <strong>Password Default</strong> yang telah diberikan oleh admin.
                </p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">2</div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Setelah berhasil masuk, Anda akan langsung diarahkan untuk <strong>memperbarui password</strong> dan mendaftarkan <strong>alamat email aktif</strong>.
                </p>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">3</div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Sistem akan otomatis mengirimkan <strong>Kode OTP</strong> 6 digit ke email tersebut untuk verifikasi keamanan akun Anda.
                </p>
              </li>
            </ul>

            {/* Alert OTP Spam */}
            <div className="flex items-start gap-3 p-4 border border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="mb-1 font-semibold">Catatan Penting terkait OTP!</p>
                <p className="leading-relaxed">
                  Jika email OTP tidak muncul di kotak masuk utama (Inbox) Anda, mohon pastikan untuk memeriksa folder <strong>Spam</strong> atau <strong>Junk</strong>. Terkadang email verifikasi terfilter secara otomatis.
                </p>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}