/**
 * Pembungkus tipis di atas fetch bawaan Node (>= 18) supaya pemakaian di
 * proyek ini terasa seperti axios: respons yang tidak 2xx melempar galat,
 * dan `timeout` dalam milidetik dipatuhi.
 *
 * Dipakai fitur konversi gambar dari URL. Tidak menambah dependensi baru,
 * karena axios tidak pernah tercantum di package.json backend.
 */
import type { IncomingHttpHeaders } from 'http';

interface ResponsUnduh {
  status: number;
  headers: IncomingHttpHeaders;
  arrayBuffer: () => Promise<Buffer>;
}

export const unduh = async (
  url: string,
  pilihan: { timeout: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<ResponsUnduh> => {
  const response = await fetch(url, {
    // fetch bawaan mengikuti redirect otomatis (maks 20) — cukup untuk pemakaian ini.
    redirect: 'follow',
    signal: AbortSignal.timeout(pilihan.timeout),
    headers: pilihan.headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()) as IncomingHttpHeaders,
    arrayBuffer: async () => Buffer.from(await response.arrayBuffer()),
  };
};

/** Mirip `axios.head`: hanya memastikan URL bisa diakses, tanpa unduh isi. */
export const kepala = async (
  url: string,
  pilihan: { timeout: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<ResponsUnduh> => {
  const response = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(pilihan.timeout),
    headers: pilihan.headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()) as IncomingHttpHeaders,
    arrayBuffer: async () => Buffer.alloc(0),
  };
};
