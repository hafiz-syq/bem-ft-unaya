/**
 * Aturan tunggal tentang origin mana yang boleh memanggil API.
 *
 * Tujuan: aplikasi bisa dibuka dari HP atau komputer lain di jaringan kampus
 * (alamat LAN seperti http://192.168.1.10:5173) TANPA membuka pintu untuk
 * origin internet mana pun.
 *
 * Aturan yang berlaku:
 * 1. Origin tanpa host (permintaan server-ke-server, curl, health check) selalu
 *    boleh — permintaan seperti ini tidak tunduk pada kebijakan CORS browser.
 * 2. Origin yang didaftarkan eksplisit di env (FRONTEND_URL / FRONTEND_URLS)
 *    selalu boleh. Ini jalur untuk domain publik saat produksi.
 * 3. Origin lokal & jaringan privat boleh: localhost, 127.0.0.1, ::1,
 *    10.x, 172.16-31.x, 192.168.x, link-local (169.254.x), CGNAT (100.64-127.x),
 *    serta IPv6 ULA (fc00::/7) dan link-local (fe80::/10). Semuanya hanya ada di
 *    jaringan lokal sehingga tidak bisa dipakai halaman publik di internet.
 * 4. Selain itu DITOLAK: tidak ada header Access-Control-Allow-Origin, sehingga
 *    browser memblokir permintaannya.
 */

/** Daftar origin eksplisit dari env. Boleh lebih dari satu, dipisah koma. */
export const daftarOriginEksplisit = (): string[] =>
  (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const HOST_LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

const tanpaKurung = (hostname: string) => hostname.replace(/^\[|\]$/g, '').toLowerCase();

const isHostLoopback = (hostname: string): boolean => {
  const host = tanpaKurung(hostname);
  // "*.localhost" juga loopback menurut spesifikasi, dan sering dipakai port-forward.
  return HOST_LOOPBACK.has(host) || host.endsWith('.localhost');
};

const isIPv4Privat = (hostname: string): boolean => {
  const cocok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!cocok) return false;

  const a = Number(cocok[1]);
  const b = Number(cocok[2]);
  if (a > 255 || b > 255) return false;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
};

const isIPv6Privat = (hostname: string): boolean => {
  const host = tanpaKurung(hostname);
  // fc00::/7 (unique local) dan fe80::/10 (link-local)
  return /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
};

/** Apakah origin ini berasal dari mesin lokal atau jaringan privat (LAN). */
export const isOriginLokalAtauLAN = (origin: string): boolean => {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // termasuk string "null" yang dikirim beberapa browser
  }

  // Hanya http/https. Skema lain (file:, chrome-extension:, dll.) tidak pernah sah.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname;
  return isHostLoopback(host) || isIPv4Privat(host) || isIPv6Privat(host);
};

/** Keputusan akhir untuk satu nilai header Origin. */
export const bolehkanOrigin = (origin?: string): boolean => {
  // Tanpa header Origin: bukan permintaan lintas-situs, jadi selalu boleh.
  if (!origin) return true;

  const normal = origin.replace(/\/+$/, '');
  if (daftarOriginEksplisit().includes(normal)) return true;

  return isOriginLokalAtauLAN(normal);
};
