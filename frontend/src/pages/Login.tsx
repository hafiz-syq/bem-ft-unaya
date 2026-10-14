import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // 1. Tambahkan Link di sini
import { User, Lock, Loader2, ArrowLeft } from 'lucide-react'; // Ditambahkan ArrowLeft opsional untuk ikon
import axios from 'axios';
import { api } from '../lib/axios';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      } else {
        setError('Terjadi kesalahan yang tidak terduga');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">BEM-FT UNAYA</h1>
          <p className="text-gray-500 mt-2">Portal Sistem Informasi Mahasiswa</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIM / Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-400 focus:border-amber-400 bg-gray-50 text-gray-900"
                placeholder="Masukkan NIM Anda"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-400 focus:border-amber-400 bg-gray-50 text-gray-900"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-amber-400 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Masuk'}
          </button>
        </form>

        {/* 2. Tombol Kembali dengan React Router Link & Styling Tailwind */}
        <div className="text-center pt-2">
          <Link 
            to="/" 
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-amber-600 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
