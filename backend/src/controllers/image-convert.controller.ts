import { Response, NextFunction } from 'express';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logActivity } from '../services/audit.service';
import { isAdminRole } from '../lib/ticket-access';
import { unduh, kepala } from '../lib/http';

/**
 * Konversi gambar dari URL web menjadi WebP yang lebih ringan.
 *
 * Fitur ini memungkinkan admin/pengurus:
 * - Paste URL gambar eksternal (mis. dari website lain, Google Images, dll)
 * - Server mengunduh gambar, mendeteksi format asli, dan mengonversi ke WebP
 * - Hasil konversi disimpan dengan ukuran yang lebih kecil (lebih ringan untuk web)
 * - Semua jenis gambar tetap diterima (JPG, PNG, GIF, WEBP, AVIF, HEIC, BMP, dll)
 *
 * Pembatas keamanan:
 * - Hanya admin/pengurus yang bisa menggunakan fitur ini
 * - Max ukuran file 10 MB (lebih besar ditolak)
 * - Timeout download 30 detik
 * - Hanya URL HTTP/HTTPS yang diizinkan
 * - URL tidak boleh ke domain localhost/internal (cegah SSRF)
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DOWNLOAD_TIMEOUT_MS = 30000;
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const WEBP_QUALITY = 82;
const MAX_DIMENSION = 1920; // max 1920px (scales down larger images)

// Pastikan folder uploads ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Daftar ekstensi yang dikenal (semua jenis gambar didukung)
const GAMBAR_EXTENSI = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif',
  '.bmp', '.tiff', '.tif', '.svg', '.ico', '.jfif', '.pjpeg', '.pjp',
]);

const ekstensiDariMime = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/vnd.microsoft.icon': '.ico',
  };
  return map[mimeType] || '.bin';
};

const validUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    // Cegah SSRF: tolak localhost, IP internal, dan domain internal
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') || host.startsWith('172.17.') || host.startsWith('172.18.') ||
      host.startsWith('172.19.') || host.startsWith('172.20.') || host.startsWith('172.21.') ||
      host.startsWith('172.22.') || host.startsWith('172.23.') || host.startsWith('172.24.') ||
      host.startsWith('172.25.') || host.startsWith('172.26.') || host.startsWith('172.27.') ||
      host.startsWith('172.28.') || host.startsWith('172.29.') || host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host.startsWith('192.168.') ||
      host.startsWith('0.') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.private') ||
      host === '[::1]' ||
      host === '[fd00::]' // IPv6 unique local
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const downloadGambar = async (
  url: string
): Promise<{ data: Buffer; mimeType: string; originalUrl: string }> => {
  if (!validUrl(url)) {
    throw new Error('URL tidak valid atau tidak diizinkan. Hanya URL http/https ke domain publik yang boleh digunakan.');
  }

  const response = await unduh(url, {
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'BEM-FT UNAYA Image Converter/1.0',
      'Accept': 'image/*',
    },
  });

  const mimeType = response.headers['content-type']?.split(';')[0]?.trim() || 'application/octet-stream';
  const data = await response.arrayBuffer();

  if (!data.length) {
    throw new Error('Gambar kosong atau tidak dapat diunduh.');
  }

  if (data.length > MAX_FILE_SIZE) {
    throw new Error(`Ukuran file terlalu besar (maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB).`);
  }

  // Validasi bahwa yang didownload memang gambar
  if (!mimeType.startsWith('image/')) {
    throw new Error('URL tersebut bukan gambar. Mohon berikan URL ke file gambar (JPG, PNG, GIF, WEBP, dll).');
  }

  // Tolak SVG karena bisa berisi script
  if (mimeType === 'image/svg+xml') {
    throw new Error('SVG tidak didukung karena keamanan (bisa memuat script). Gunakan JPG, PNG, atau WebP.');
  }

  return { data, mimeType, originalUrl: url };
};

const konversiKeWebp = async (
  data: Buffer,
  mimeType: string,
  outputPath: string
): Promise<{ path: string; size: number; metadata: { width: number; height: number; format: string } }> => {
  let image = sharp(data, { failOn: 'none', limitInputPixels: 60_000_000 });

  // Dapatkan metadata untuk ditentukan apakah perlu resize
  const metadata = await image.metadata();

  // Resize jika gambar terlalu besar (untuk optimasi web)
  if (metadata.width && metadata.width > MAX_DIMENSION) {
    image = image.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Konversi ke WebP dengan kualitas optimal
  await image
    .rotate() // hormati orientasi EXIF
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toFile(outputPath);

  const stat = await fs.promises.stat(outputPath);
  const hasilMetadata = await sharp(outputPath).metadata();

  return {
    path: outputPath,
    size: stat.size,
    metadata: {
      width: hasilMetadata.width || 0,
      height: hasilMetadata.height || 0,
      format: 'webp',
    },
  };
};

interface HasilKonversi {
  originalUrl: string;
  originalMimeType: string;
  convertedPath: string;
  convertedUrl: string;
  convertedSize: number;
  originalSize: number;
  compressionRatio: string; // persentase pengurangan ukuran, mis. "65.2%"
  width: number;
  height: number;
  format: 'webp';
}

export const konversiGambarDariUrl = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'URL gambar wajib diisi.' });
      return;
    }

    // Download gambar dari URL
    const { data, mimeType, originalUrl } = await downloadGambar(url);

    // Buat nama file unik
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const ext = ekstensiDariMime(mimeType);
    const filename = `CONVERTED-${timestamp}-${random}${ext}`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    // Konversi ke WebP
    const hasil = await konversiKeWebp(data, mimeType, outputPath);

    // Hitung rasio kompresi
    const compressionRatio = ((1 - hasil.size / data.length) * 100).toFixed(1);

    const convertedUrl = `/uploads/${path.basename(hasil.path)}`;

    await logActivity(
      req.user.id,
      'CONVERT_IMAGE_FROM_URL',
      'Image',
      `Mengonversi gambar dari URL: ${originalUrl}`,
      convertedUrl,
      { originalUrl, convertedUrl, originalSize: data.length, convertedSize: hasil.size }
    );

    res.status(200).json({
      message: `Gambar berhasil dikonversi dari URL. Ukuran berkurang ${compressionRatio}%.`,
      data: {
        originalUrl,
        originalMimeType: mimeType,
        convertedPath: hasil.path,
        convertedUrl,
        originalSize: data.length,
        convertedSize: hasil.size,
        compressionRatio: `${compressionRatio}%`,
        width: hasil.metadata.width,
        height: hasil.metadata.height,
        format: 'webp' as const,
      } as HasilKonversi,
    });
  } catch (error: any) {
    // Error dari download/validation adalah error input pengguna (400)
    if (error.message && (
      error.message.includes('URL tidak valid') ||
      error.message.includes('not a gambar') ||
      error.message.includes('Ukuran file terlalu besar') ||
      error.message.includes('SVG tidak didukung') ||
      error.message.includes('gambar kosong') ||
      error.message.includes('timeout') ||
      error.message.includes('Network') ||
      error.message.includes('Request failed')
    )) {
      res.status(400).json({ message: error.message || 'Gagal mengunduh gambar dari URL.' });
      return;
    }

    // Error sistem lainnya lempar ke error handler
    next(error);
  }
};

/**
 * Endpoint GET untuk memprediksi hasil konversi tanpa benar-benar menyimpan.
 * Berguna untuk preview sebelum admin memutuskan untuk menyimpan gambar.
 */
export const previewKonversiGambar = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'URL gambar wajib diisi sebagai query parameter.' });
      return;
    }

    const { data, mimeType, originalUrl } = await downloadGambar(url);
    const metadata = await sharp(data, { failOn: 'none', limitInputPixels: 60_000_000 }).metadata();

    const predictedSize = Math.round(data.length * 0.3); // estimasi WebP biasanya 30% dari asli

    res.status(200).json({
      message: 'Informasi preview konversi.',
      data: {
        originalUrl,
        originalMimeType: mimeType,
        originalSize: data.length,
        predictedConvertedSize: predictedSize,
        predictedCompressionRatio: ((1 - predictedSize / data.length) * 100).toFixed(1) + '%',
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: (metadata.format || 'unknown') as string,
        note: 'Ini hanya preview. Gunakan POST /api/image-convert/konversi untuk konversi sebenarnya.',
      },
    });
  } catch (error: any) {
    if (error.message && (
      error.message.includes('URL tidak valid') ||
      error.message.includes('not a gambar') ||
      error.message.includes('SVG tidak didukung')
    )) {
      res.status(400).json({ message: error.message });
      return;
    }
    next(error);
  }
};

/**
 * Helper: validasi URL gambar untuk penggunaan di frontend.
 * Bisa dipanggil dari frontend untuk memeriksa apakah URL gambar valid sebelum dikirim.
 */
export const validasiUrlGambar = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Diambil sebelum try: blok catch tetap punya nilai bila validasi gagal.
  const urlMasuk = typeof req.body?.url === 'string' ? (req.body.url as string) : '';

  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'URL gambar wajib diisi.' });
      return;
    }

    if (!validUrl(url)) {
      res.status(400).json({ message: 'URL tidak valid atau tidak diizinkan. Gunakan URL http/https ke domain publik.' });
      return;
    }

    // Cek HEAD request hanya untuk validasi
    await kepala(url, {
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirects: 5,
      headers: { 'User-Agent': 'BEM-FT UNAYA Image Validator/1.0' },
    });

    res.status(200).json({
      message: 'URL gambar valid.',
      data: {
        url,
        isValid: true,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message.includes('Request failed') ? 'Gagal mengakses URL. Pastikan URL publik dan dapat diakses.' : (error.message || 'URL tidak valid.'),
      data: { url: urlMasuk, isValid: false },
    });
  }
};
