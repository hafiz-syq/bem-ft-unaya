import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useLocation } from 'react-router-dom';

/**
 * Web Analytics & Speed Insights Vercel.
 *
 * Aplikasi ini memakai HashRouter, jadi lokasi browser selalu berupa '/' dan
 * rute sebenarnya hidup di belakang tanda '#' (mis. /#/dashboard). Skrip
 * Vercel yang melacak rute secara otomatis akan mencatat semua halaman sebagai
 * '/' — karena itu pelacakan otomatis dimatikan (properti `route`) dan pageview
 * dikirim manual mengikuti rute router.
 */

/** ID panjang (cuid Prisma, dkk.) diganti [id] supaya datanya tidak terpecah per item. */
const normalisasiRute = (path: string): string =>
  path.replace(/\/[a-z0-9]{20,}(?=\/|$)/gi, '/[id]');

/**
 * Saring URL yang masih membawa token (reset password, verifikasi email).
 * Token adalah rahasia — tidak boleh ikut terkirim ke analitik pihak ketiga.
 */
const tanpaToken = <T extends { url: string }>(event: T): T | null =>
  event.url.includes('token=') ? null : event;

export default function VercelAnalytics() {
  const location = useLocation();
  // Di HashRouter, pathname ini sudah rute di dalam hash (mis. /dashboard).
  // Query string tidak dikirim karena bisa berisi token bersifat rahasia.
  const rute = normalisasiRute(location.pathname);

  return (
    <>
      <Analytics route={rute} path={rute} beforeSend={tanpaToken} />
      <SpeedInsights route={rute} beforeSend={tanpaToken} />
    </>
  );
}
