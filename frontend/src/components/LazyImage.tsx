import type { ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

/**
 * Gambar dengan lazy-loading bawaan browser.
 *
 * Sebelumnya unduhan ditunda lewat IntersectionObserver (margin 400px) dan
 * `src` baru dipasang setelah JS berjalan. Itu memicu ketidakcocokan hidrasi
 * saat halaman dirampang di build: HTML prerender memuat `src`, sedangkan
 * render pertama klien belum memilikinya (React #418) — pohon dirender ulang
 * penuh di klien dan manfaat prerender lenyap.
 *
 * Sekarang `src` dirender langsung dengan `loading="lazy"`: browser bawaan
 * hanya mengunduh gambar yang mendekati viewport, atributnya identik antara
 * hasil prerender dan hidrasi, dan pengurang JS di bundle.
 */
export default function LazyImage({ src, alt, className = '', ...rest }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      {...rest}
    />
  );
}
