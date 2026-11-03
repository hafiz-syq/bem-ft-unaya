/**
 * Pembungkus tipis di atas fetch bawaan Node (>= 18) supaya pemakaian di
 * proyek ini terasa seperti axios: respons yang tidak 2xx melempar galat,
 * dan `timeout` dalam milidetik dipatuhi.
 *
 * Dipakai fitur konversi gambar dari URL. Tidak menambah dependensi baru,
 * karena axios tidak pernah tercantum di package.json backend.
 *
 * Pengaman SSRF:
 * - Setiap hop (URL awal dan tiap lokasi redirect) diperiksa: host privat/
 *   internal ditolak, termasuk IP metadata (169.254.x.x), CGNAT, dan ULA IPv6.
 * - Redirect diikuti MANUAL (bukan `redirect: 'follow'`) supaya pemeriksaan
 *   host tidak bisa dilewati: dengan follow otomatis, URL publik yang
 *   redirect ke localhost/internal tetap diunduh oleh server.
 */
import type { IncomingHttpHeaders } from 'http';
import { promises as dns } from 'dns';

interface ResponsUnduh {
  status: number;
  headers: IncomingHttpHeaders;
  arrayBuffer: () => Promise<Buffer>;
  urlAkhir: string;
}

/** Hostname (host atau domain) yang tidak boleh diakses dari server. */
export const hostTidakAman = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return true;

  // Nama spesial loopback & zona internal.
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.private') || host.endsWith('.lan')) {
    return true;
  }

  // Bukan alamat IP? Domain publik dianggap sah (DNS tetap bisa dipalsukan,
  // tetapi itu lapisan ancaman yang berbeda — jaringan keluar dibatasi env Vercel).
  const ip4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ip4) {
    const a = Number(ip4[1]);
    const b = Number(ip4[2]);
    if (a > 255 || b > 255) return true; // bukan IPv4 sah -> tolak
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10/8, loopback
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192) return b === 168; // 192.168/16 (192.168 saja yang privat)
    return false;
  }

  // IPv6: loopback, ULA fc00::/7, link-local fe80::/10, unspecified ::.
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    const pertama = parseInt(host, 16);
    if (!Number.isNaN(pertama) && ((pertama & 0xfe00) === 0xfc00 || (pertama & 0xffc0) === 0xfe80)) return true;
    return false;
  }

  return false;
};

const tolak = (pesan: string): Error => new Error(pesan);

/**
 * Pemeriksaan host sebelum fetch.
 *
 * `hostTidakAman` hanya mengenali alamat yang ditulis apa adanya, sedangkan
 * `http://2130706433/` dan `http://127.1/` juga menunjuk ke loopback, dan
 * sebuah domain publik bisa saja menunjuk ke 10.0.0.1. Karena itu hostname
 * selalu di-resolve lebih dulu dan SETIAP jawaban diperiksa; gagal resolve
 * diperlakukan sebagai penolakan (fail closed).
 *
 * Sisa risiko: DNS bisa menjawab berbeda saat fetch gerçekten koneksi dibuat
 * (rebinding). Jeda antara keduanya milidetik dan tidak ada mekanisme sah untuk
 * mengganti rekord secepat itu; perlindungan penuh butuh mengunci IP.
 */
const pastikanHostAman = async (hostname: string): Promise<void> => {
  if (hostTidakAman(hostname)) throw tolak('Request failed: host internal/private tidak diizinkan.');

  let jawaban: { address: string }[];
  try {
    jawaban = await dns.lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
  } catch {
    throw tolak('Request failed: host tidak dapat di-resolve.');
  }
  if (jawaban.some((a) => hostTidakAman(a.address))) {
    throw tolak('Request failed: host internal/private tidak diizinkan.');
  }
};

/** Mengikuti redirect secara manual sambil memeriksa setiap host hop. */
const ikutiDenganPemeriksaan = async (
  url: string,
  metode: 'GET' | 'HEAD',
  pilihan: { timeout: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<Response> => {
  let target = url;
  const hopMaks = pilihan.maxRedirects ?? 5;

  for (let hop = 0; hop <= hopMaks; hop++) {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw tolak('Request failed: hanya http/https yang diizinkan.');
    }
    await pastikanHostAman(parsed.hostname);

    const response = await fetch(target, {
      method: metode,
      redirect: 'manual',
      signal: AbortSignal.timeout(pilihan.timeout),
      headers: pilihan.headers,
    });

    if (response.status >= 300 && response.status < 400) {
      const lokasi = response.headers.get('location');
      if (!lokasi) return response;
      target = new URL(lokasi, target).toString();
      continue;
    }

    return response;
  }

  throw tolak('Request failed: terlalu banyak redirect.');
};

const bentukRespons = async (response: Response, urlAkhir: string): Promise<ResponsUnduh> => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()) as IncomingHttpHeaders,
    arrayBuffer: async () => Buffer.from(await response.arrayBuffer()),
    urlAkhir,
  };
};

export const unduh = async (
  url: string,
  pilihan: { timeout: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<ResponsUnduh> => {
  const response = await ikutiDenganPemeriksaan(url, 'GET', pilihan);
  return bentukRespons(response, response.url || url);
};

/** Mirip `axios.head`: hanya memastikan URL bisa diakses, tanpa unduh isi. */
export const kepala = async (
  url: string,
  pilihan: { timeout: number; maxRedirects?: number; headers?: Record<string, string> }
): Promise<ResponsUnduh> => {
  const response = await ikutiDenganPemeriksaan(url, 'HEAD', pilihan);
  return bentukRespons(response, response.url || url);
};
