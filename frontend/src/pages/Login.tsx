import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // 1. Tambahkan Link di sini
import { User, Lock, Loader2, ArrowLeft } from 'lucide-react'; // Ditambahkan ArrowLeft opsional untuk ikon
import PasswordInput from '../components/PasswordInput';
import axios from 'axios';
import { api } from '../lib/axios';
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
        navigate('/dashboard');
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
      <div className="relative w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="text-center">
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
            {errorPerangkat && <p className="font-bold mb-1">Akun sedang dipakai di perangkat lain</p>}
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
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-400 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-300 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* 2. Tombol Kembali dengan React Router Link & Styling Tailwind */}
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
    </div>
  );
}
