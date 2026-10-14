// Tambahkan kata kunci 'type' sebelum ReactNode
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../lib/axios';

interface User {
  id: string;
  nim: string;
  role: 'MAHASISWA' | 'PENGURUS' | 'ADMIN';
  first_login: boolean;
  // Dipakai penjaga rute: selama email ada tapi belum terverifikasi,
  // pengguna ditahan di halaman /verify-email.
  email: string | null;
  email_verified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch { 
        // Hapus (error) di catch agar tidak memicu error 'no-unused-vars'
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
    } catch (error) {
      console.error('Logout gagal', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Bypass error vite fast-refresh untuk export fungsi non-komponen
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};