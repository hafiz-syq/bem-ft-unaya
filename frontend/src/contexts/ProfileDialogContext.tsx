import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import UserProfileDialog from '../components/UserProfileDialog';

/**
 * Satu dialog profil bersama untuk seluruh aplikasi.
 *
 * Halaman cukup memanggil `bukaProfil(userId)` dari avatar/nama pengguna, tanpa
 * perlu menyalin state dan animasi dialog di setiap halaman. Tamu tidak bisa
 * membuka profil: `bukaProfil` diabaikan bila belum login, dan backend juga
 * menolak endpoint profil dengan 401.
 */
interface ProfileDialogContextType {
  bukaProfil: (userId: string) => void;
}

const ProfileDialogContext = createContext<ProfileDialogContextType | undefined>(undefined);

export function ProfileDialogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);

  const bukaProfil = useCallback((id: string) => {
    if (!user || !id) return;
    setUserId(id);
  }, [user]);

  const nilai = useMemo(() => ({ bukaProfil }), [bukaProfil]);

  return (
    <ProfileDialogContext.Provider value={nilai}>
      {children}
      {userId && <UserProfileDialog key={userId} userId={userId} onClose={() => setUserId(null)} />}
    </ProfileDialogContext.Provider>
  );
}

// Bypass error vite fast-refresh untuk export hook non-komponen.
// eslint-disable-next-line react-refresh/only-export-components
export const useProfileDialog = (): ProfileDialogContextType => {
  const context = useContext(ProfileDialogContext);
  if (context === undefined) {
    throw new Error('useProfileDialog harus digunakan di dalam ProfileDialogProvider');
  }
  return context;
};
