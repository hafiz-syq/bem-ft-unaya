import { v2 as cloudinary } from 'cloudinary';

/**
 * Penyimpanan gambar di Cloudinary.
 *
 * Di Vercel (serverless) filesystem bersifat sementara: berkas yang ditulis ke
 * `/tmp` hilang begitu instance dingin atau deployment baru dibuat. Karena itu
 * gambar disimpan ke Cloudinary dan yang masuk database hanya URL-nya
 * (https://res.cloudinary.com/...), yang tetap hidup di luar siklus deploy.
 *
 * Kredensial dibaca dari environment variable (bukan dari berkas yang
 * di-commit):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

/** true bila ketiga kredensial Cloudinary tersedia. */
export const cloudinarySiap = (): boolean =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

/**
 * Konfigurasi dibaca saat dipakai, bukan saat modul dimuat, agar `.env` lokal
 * sudah terbaca pada semua jalur (server, skrip CLI, pengujian).
 */
const terapkanKonfigurasi = (): void => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};

/** Galat penyimpanan gambar yang membawa kode HTTP sendiri (bukan 500). */
const galatPenyimpanan = (message: string, statusCode = 502): Error => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export interface HasilUnggah {
  secureUrl: string;
  publicId: string;
}

/**
 * Mengunggah buffer ke Cloudinary.
 *
 * Buffer dipakai (bukan path berkas) supaya fungsi ini bekerja sama saja di
 * server biasa maupun di Vercel, tanpa perlu menulis apa pun ke disk.
 *
 * resourceType 'image' (default) untuk gambar yang diolah Cloudinary;
 * 'raw' untuk berkas arbitrer (PDF, DOCX, XLSX, PPTX) yang cukup disimpan
 * dan disajikan apa adanya.
 */
export const unggahKeCloudinary = (
  buffer: Buffer,
  opsi: {
    folder: string;
    publicId?: string;
    format?: string;
    resourceType?: 'image' | 'raw';
  }
): Promise<HasilUnggah> => {
  const resourceType = opsi.resourceType ?? 'image';
  if (!cloudinarySiap()) {
    throw galatPenyimpanan(
      'Penyimpanan gambar (Cloudinary) belum dikonfigurasi di server. Hubungi admin.',
      503
    );
  }

  terapkanKonfigurasi();

  return new Promise<HasilUnggah>((resolve, reject) => {
    const aliran = cloudinary.uploader.upload_stream(
      {
        folder: opsi.folder,
        public_id: opsi.publicId,
        // Format baku media gambar = AVIF. Berkas raw tidak diberi format
        // supaya Cloudinary menyimpannya apa adanya (ekstensi mengikuti nama).
        format: resourceType === 'image' ? opsi.format ?? 'avif' : undefined,
        quality: resourceType === 'image' ? 'auto' : undefined,
        resource_type: resourceType,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          console.error('[cloudinary] unggah gagal:', error?.message || error);
          reject(
            galatPenyimpanan(
              'Gagal menyimpan gambar ke penyimpanan awan. Coba lagi beberapa saat lagi.'
            )
          );
          return;
        }
        if (!result?.secure_url) {
          reject(galatPenyimpanan('Penyimpanan gambar tidak mengembalikan URL berkas.'));
          return;
        }
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      }
    );

    aliran.end(buffer);
  });
};

/**
 * Mengambil public_id dan jenis resource dari URL Cloudinary.
 *
 * Gambar: https://res.cloudinary.com/<cloud>/image/upload/v1729/profiles/FOTO.webp
 *   -> { tipe: 'image', publicId: 'profiles/FOTO' }
 *   Query, segmen versi (`v123`), transformasi dan ekstensi dibuang karena
 *   `uploader.destroy` mengenali berkas gambar dari public_id tanpa ekstensi.
 *
 * Berkas raw: https://res.cloudinary.com/<cloud>/raw/upload/v1729/documents/KAJT.pdf
 *   -> { tipe: 'raw', publicId: 'documents/KAJT.pdf' }
 *   Ekstensi ikut dipertahankan karena pada resource_type raw nama berkas
 *   adalah bagian dari public_id.
 */
export const ambilReferensiAwan = (
  url: string
): { tipe: 'image' | 'raw'; publicId: string | null } => {
  if (!url) return { tipe: 'image', publicId: null };

  const tanpaQuery = url.split('?')[0];
  const tipe: 'image' | 'raw' = tanpaQuery.includes('/raw/upload/') ? 'raw' : 'image';
  const penanda = tipe === 'raw' ? '/raw/upload/' : '/image/upload/';
  const posisi = tanpaQuery.indexOf(penanda);
  if (posisi === -1) return { tipe, publicId: null };

  let sisa = tanpaQuery
    .slice(posisi + penanda.length)
    .replace(/^v\d+\//, '') // segmen versi
    .replace(/^[a-z]{1,3}_[^/]+\//i, ''); // transformasi (mis. c_fill,w_200)

  if (tipe === 'image') sisa = sisa.replace(/\.[a-zA-Z0-9]+$/, '');
  return { tipe, publicId: sisa ? decodeURIComponent(sisa) : null };
};

/**
 * Menghapus berkas dari Cloudinary berdasarkan URL yang tersimpan di database.
 * Jenis resource dibaca dari URL supaya gambar maupun berkas raw dibersihkan
 * dengan benar. Kegagalan diabaikan (hanya dicatat) supaya data pengguna tetap
 * bisa diubah walaupun penyimpanan awan sedang bermasalah.
 */
export const hapusDariCloudinary = async (url: string): Promise<void> => {
  if (!cloudinarySiap()) return;

  const { tipe, publicId } = ambilReferensiAwan(url);
  if (!publicId) return;

  terapkanKonfigurasi();

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: tipe });
  } catch (error: any) {
    console.error('[cloudinary] hapus gagal:', error?.message || error);
  }
};
