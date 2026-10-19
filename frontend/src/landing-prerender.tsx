/**
 * Titik masuk prerender halaman landing (khusus build, tidak diunduh browser).
 *
 * Merender halaman menjadi HTML dengan ReactDOMServer PADA SAAT BUILD, lalu
 * plugin prerenderLanding di vite.config.ts menempelkan hasilnya ke
 * <div id="root"> di dist/index.html.visited:
 *
 * - Pengunjung langsung menerima HTML berisi hero, menu, bagian struktur
 *   (ditanam Lighthouse Performance tinggi, karena konten utama terlihat
 *   tanpa menunggu JavaScript terunduh).
 * - Setelah JS dimuat, main.tsx memakai hydrateRoot (bukan createRoot) supaya
 *   React tidak merender ulang dari nol — semua fitur interaktif tetap hidup.
 *
 * Data dinamis (berita/agenda/galeri) tetap diambil dari backend di browser
 * setelah hidrasi, jadi tidak ada konten yang tertinggal.
 */
import { renderToReadableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';

/**
 * Merender pohon app utama (bukan hanya Landing) supaya struktur pembungkusnya
 * — termasuk <Suspense> di App.tsx — persis sama dengan pohon yang dihidrasi
 * di browser. Perbedaan struktur inilah yang sebelumnya memicu galat hidrasi
 * React #418.
 *
 * renderToPipeableStream dipakai (bukan renderToStaticMarkup) karena ia
 * menyisipkan penanda batas Suspense (<!--$--> … <!--/$-->) yang WAJIB ada
 * dalam HTML hasil prerender supaya hidrasi mengenali batas tersebut. Tanpa
 * penanda itu React menganggap isi HTML tidak cocok dan merender ulang dari
 * nol di klien — kehilangan manfaat prerender.
 */
export async function renderMarkupLanding(): Promise<string> {
  const strim = await renderToReadableStream(
    <StaticRouter location="/">
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </StaticRouter>
  );

  const pembaca = strim.getReader();
  const pengolah = new TextDecoder();
  let hasil = '';
  for (;;) {
    const { done, value } = await pembaca.read();
    if (done) break;
    hasil += pengolah.decode(value, { stream: true });
  }
  hasil += pengolah.decode();
  return hasil;
}
