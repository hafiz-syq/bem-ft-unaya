import { useEffect, useState } from 'react';
import { api } from './axios';

/**
 * Hak akses arsip surat, dibaca sekali per sesi lalu dipakai bersama oleh
 * sidebar dan halaman arsip.
 *
 * Penjagaan sebenarnya ada di server (setiap endpoint arsip memeriksa jabatan);
 * data ini hanya untuk menyembunyikan menu dan menampilkan pesan yang tepat.
 */
export interface AksesArsip {
  bolehAkses: boolean;
  bolehArah: boolean;
}

const DITOLAK: AksesArsip = { bolehAkses: false, bolehArah: false };

let tersimpan: { userId: string; akses: AksesArsip } | null = null;
let janji: { userId: string; hasil: Promise<AksesArsip> } | null = null;

export function muatAksesArsip(userId: string): Promise<AksesArsip> {
  if (tersimpan?.userId === userId) return Promise.resolve(tersimpan.akses);
  if (janji?.userId === userId) return janji.hasil;

  const hasil = api
    .get('/documents/akses')
    .then((res) => {
      const akses: AksesArsip = {
        bolehAkses: Boolean(res.data?.bolehAkses),
        bolehArah: Boolean(res.data?.bolehArah),
      };
      tersimpan = { userId, akses };
      return akses;
    })
    .catch(() => DITOLAK);

  janji = { userId, hasil };
  return hasil;
}

/**
 * `userId` null berarti tidak perlu bertanya (mis. mahasiswa yang jelas tidak
 * berhak): tidak ada permintaan jaringan yang dikirim.
 */
export function useAksesArsip(userId?: string | null): AksesArsip | null {
  const [akses, setAkses] = useState<AksesArsip | null>(
    userId && tersimpan?.userId === userId ? tersimpan.akses : null
  );

  useEffect(() => {
    if (!userId) return;
    let hidup = true;
    muatAksesArsip(userId).then((hasil) => {
      if (hidup) setAkses(hasil);
    });
    return () => {
      hidup = false;
    };
  }, [userId]);

  return akses;
}
