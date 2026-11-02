import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/axios';
import { useAuth } from './AuthContext';

/**
 * Status online pengguna.
 *
 * Setiap pengguna yang login mengirim heartbeat ringan secara berkala, lalu
 * mengambil daftar ID yang masih aktif. Indikator hijau di avatar dibaca dari
 * konteks ini sehingga konsisten di seluruh halaman tanpa polling ganda.
 *
 * Tamu tidak mengirim heartbeat dan tidak dihitung, jadi status hanya
 * mencerminkan akun yang benar-benar sedang membuka situs.
 */

interface PresenceContextType {
  /** ID pengguna yang aktif dalam ±90 detik terakhir. */
  online: Set<string>;
  /** true setelah daftar online pertama kali berhasil diambil. */
  siap: boolean;
}

const PresenceContext = createContext<PresenceContextType>({ online: new Set(), siap: false });

const JEDA_HEARTBEAT = 45_000;
const JEDA_DAFTAR_ONLINE = 30_000;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [siap, setSiap] = useState(false);
  // Reset status saat pengguna keluar: diproses saat render (pola resmi untuk
  // menyesuaikan state bila prop berubah), bukan di dalam useEffect.
  const [penggunaLalu, setPenggunaLalu] = useState(user);
  if (user !== penggunaLalu) {
    setPenggunaLalu(user);
    if (!user) {
      setOnline(new Set());
      setSiap(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    let aktif = true;

    const kirimHeartbeat = () => {
      api.post('/presence/heartbeat').catch(() => {
        // Gangguan jaringan sesaat tidak perlu mengganggu pengguna.
      });
    };

    const ambilDaftar = async () => {
      try {
        const res = await api.get('/presence/online');
        if (!aktif) return;
        const daftar = Array.isArray(res.data?.data) ? (res.data.data as string[]) : [];
        setOnline(new Set(daftar));
        setSiap(true);
      } catch {
        // Biarkan status terakhir tampil; percobaan berikutnya akan memperbarui.
      }
    };

    kirimHeartbeat();
    void ambilDaftar();

    const jadwalHeartbeat = window.setInterval(kirimHeartbeat, JEDA_HEARTBEAT);
    const jadwalDaftar = window.setInterval(() => void ambilDaftar(), JEDA_DAFTAR_ONLINE);

    // Saat tab kembali dibuka, langsung segarkan supaya status tidak basi.
    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') {
        kirimHeartbeat();
        void ambilDaftar();
      }
    };
    document.addEventListener('visibilitychange', saatTerlihat);

    return () => {
      aktif = false;
      window.clearInterval(jadwalHeartbeat);
      window.clearInterval(jadwalDaftar);
      document.removeEventListener('visibilitychange', saatTerlihat);
    };
  }, [user]);

  const nilai = useMemo(() => ({ online, siap }), [online, siap]);

  return <PresenceContext.Provider value={nilai}>{children}</PresenceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePresence = () => useContext(PresenceContext);
