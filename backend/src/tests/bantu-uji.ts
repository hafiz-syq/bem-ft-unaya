import 'dotenv/config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { TOKEN_COOKIE } from '../lib/cookies';

/**
 * Perkakas bersama untuk pengujian akses berbasis peran (401/403).
 *
 * Dipakai oleh `uji-akses-rute.ts` (matriks seluruh endpoint, `npm test`).
 *
 * Cara kerja sesi: alih-alih menebak password akun yang sudah ada, pengujian
 * membuat akun sendiri lalu menerbitkan cookie sesi dengan kunci yang SAMA
 * seperti login (JWT_SECRET, payload { id, nim, role } — lihat
 * controllers/auth.controller.ts). Yang diuji adalah lapisan otorisasi
 * (middleware requireAuth/requireRole dan pemeriksaan peran di controller),
 * jadi jalur ini tetap sah dan membuat pengujian tidak bergantung pada isi
 * basis data maupun batas percobaan login (5 permintaan / 5 menit / IP).
 */

export const API_URL = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

/** UUID yang dijamin tidak ada di basis data, untuk rute ber-parameter `:id`. */
export const ID_TIDAK_ADA = '00000000-0000-0000-0000-000000000000';

export type Peran = 'tamu' | 'mahasiswa' | 'pengurus' | 'admin';

/** `DIIZINKAN` = boleh masuk (jawaban apa pun selain 401/403). */
export type Harapan = number | 'DIIZINKAN';

export interface AkunUji {
  peran: Exclude<Peran, 'tamu'>;
  id: string;
  nim: string;
  role: Role;
  cookie: string;
}

/** Akun uji disediakan di NIM 999900xx — jangan dipakai untuk akun asli. */
const SPESIFIKASI_AKUN: { peran: Exclude<Peran, 'tamu'>; nim: string; role: Role; nama: string; profil: boolean }[] = [
  { peran: 'admin', nim: '99990000', role: Role.ADMIN, nama: 'UJI Admin', profil: false },
  { peran: 'mahasiswa', nim: '99990001', role: Role.MAHASISWA, nama: 'UJI Mahasiswa', profil: true },
  { peran: 'pengurus', nim: '99990002', role: Role.PENGURUS_BEM, nama: 'UJI Pengurus BEM', profil: true },
];

/** Cookie sesi dengan payload yang sama seperti hasil login. */
function terbitkanCookie(akun: { id: string; nim: string; role: Role }): string {
  const rahasia = process.env.JWT_SECRET;
  if (!rahasia) {
    throw new Error(
      'JWT_SECRET tidak terbaca. Isi backend/.env, atau setel variabel lingkungan JWT_SECRET sebelum menjalankan pengujian.'
    );
  }

  const token = jwt.sign(
    { id: akun.id, nim: akun.nim, role: akun.role, first_login: false },
    rahasia,
    { expiresIn: '1d' }
  );

  return `${TOKEN_COOKIE}=${token}`;
}

/**
 * Pastikan API hidup sebelum pengujian dimulai, dengan pesan yang jelas bila belum.
 *
 * Diberi beberapa percobaan karena `nodemon` di lingkungan pengembangan bisa
 * sedang memuat ulang server tepat saat pengujian dimulai.
 */
export async function pastikanServerHidup(percobaan = 8, jedaMs = 1500): Promise<void> {
  let kesalahanTerakhir = '';

  for (let i = 0; i < percobaan; i++) {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
      kesalahanTerakhir = `HTTP ${res.status}`;
    } catch (error) {
      kesalahanTerakhir = (error as Error).message;
    }
    if (i < percobaan - 1) await new Promise((r) => setTimeout(r, jedaMs));
  }

  throw new Error(
    `Tidak bisa menghubungi API di ${API_URL} setelah ${percobaan} percobaan (${kesalahanTerakhir}).\n` +
      'Jalankan server backend lebih dulu, mis. "npm run dev" di folder backend.'
  );
}

/** Buat (atau segarkan) akun uji beserta cookie sesinya. */
export async function siapkanAkunUji(): Promise<Record<Exclude<Peran, 'tamu'>, AkunUji>> {
  const password_hash = await bcrypt.hash('UjiAksesRute123', 10);
  const hasil = {} as Record<Exclude<Peran, 'tamu'>, AkunUji>;

  for (const spek of SPESIFIKASI_AKUN) {
    const akun = await prisma.user.upsert({
      where: { nim: spek.nim },
      update: {
        password_hash, role: spek.role, first_login: false, isActive: true,
        // Akun uji selalu dimulai tanpa kunci perangkat agar cookie uji (tanpa
        // payload deviceId, v=0) tetap sah meski pengujian sebelumnya mengubah data.
        deviceId: null, deviceLabel: null, deviceBoundAt: null,
        pendingDeviceId: null, pendingDeviceLabel: null, pendingDeviceAt: null,
        sessionVersion: 0,
      },
      create: {
        nim: spek.nim,
        password_hash,
        role: spek.role,
        first_login: false,
        isActive: true,
        ...(spek.profil
          ? { profile: { create: { nama: spek.nama, nim: spek.nim, program_studi: 'TEKNIK SIPIL' } } }
          : {}),
      },
      select: { id: true, nim: true, role: true },
    });

    hasil[spek.peran] = { peran: spek.peran, ...akun, cookie: terbitkanCookie(akun) };
  }

  return hasil;
}

/** Hapus akun uji beserta profilnya (urutan mengikuti foreign key). */
export async function hapusAkunUji(akun: { id: string }[]): Promise<void> {
  for (const a of akun) {
    await prisma.studentProfile.deleteMany({ where: { userId: a.id } });
    await prisma.user.deleteMany({ where: { id: a.id } });
  }
}

export interface HasilPermintaan {
  status: number;
  body: string;
  contentType: string;
}

/** Kirim permintaan ke API; `cookie` kosong berarti tamu (tanpa sesi). */
export async function minta(
  jalur: string,
  opsi: { metode?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<HasilPermintaan> {
  const metode = opsi.metode ?? 'GET';
  // Untuk metode tulis, body kosong tetap dikirim sebagai {} supaya controller
  // menjalankan jalur validasinya (400) dan bukan gagal karena `req.body`
  // bernilai undefined (Express 5 tidak mengisinya bila tidak ada body).
  const adaBody = metode !== 'GET' && metode !== 'DELETE';
  const body = opsi.body !== undefined ? opsi.body : adaBody ? {} : undefined;

  const res = await fetch(`${API_URL}${jalur}`, {
    method: metode,
    headers: {
      ...(opsi.cookie ? { cookie: opsi.cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opsi.headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });

  return { status: res.status, body: await res.text(), contentType: res.headers.get('content-type') ?? '' };
}

/** Pencatat hasil: lulus, gagal, temuan, dan sel yang sengaja tidak diuji. */
export class Laporan {
  lulus = 0;
  gagal = 0;
  temuan = 0;
  dilewati = 0;

  private readonly catatanTemuan: string[] = [];
  private readonly catatanKonfirmasi: string[] = [];

  luluskan(nama: string): void {
    this.lulus++;
    console.log(`  LULUS   ${nama}`);
  }

  gagalkan(nama: string, dapat: unknown, harus: unknown): void {
    this.gagal++;
    console.log(`  GAGAL   ${nama}  (dapat: ${dapat}, harus: ${harus})`);
  }

  /**
   * Ketidaksesuaian yang sudah diketahui dan menunggu keputusan pemilik proyek.
   * Dilaporkan gamblang di akhir, tetapi tidak menggagalkan CI supaya temuan lama
   * tidak menutupi regresi baru. Hapus penanda `temuan` pada barisnya begitu
   * aturannya diperbaiki — baris itu otomatis ikut dijaga ketat.
   */
  catatTemuan(nama: string, penjelasan: string, dapat: unknown, harus: unknown): void {
    this.temuan++;
    this.catatanTemuan.push(`${nama} — dapat ${dapat}, diharapkan ${harus}: ${penjelasan}`);
    console.log(`  TEMUAN  ${nama}  (dapat: ${dapat}, diharapkan: ${harus})`);
  }

  /**
   * Catatan pada baris yang membawa penanda `temuan` tetapi hasilnya sudah
   * sesuai harapan. Dicetak terpisah supaya pertanyaan "apakah aturan ini memang
   * disengaja?" tidak hilang begitu saja.
   */
  catatKonfirmasi(nama: string, penjelasan: string): void {
    this.catatanKonfirmasi.push(`${nama}: ${penjelasan}`);
  }

  lewati(nama: string, alasan: string): void {
    this.dilewati++;
    console.log(`  LEWAT   ${nama}  (${alasan})`);
  }

  ringkas(judul: string): void {
    console.log(`\n--- RINGKASAN ${judul} ---`);
    console.log(`Lulus   : ${this.lulus}`);
    console.log(`Gagal   : ${this.gagal}`);
    console.log(`Temuan  : ${this.temuan}`);
    console.log(`Dilewati: ${this.dilewati}`);

    if (this.catatanTemuan.length > 0) {
      console.log('\nTEMUAN YANG MENUNGGU KEPUTUSAN (tidak menggagalkan uji):');
      for (const t of this.catatanTemuan) console.log(`  - ${t}`);
    }

    if (this.catatanKonfirmasi.length > 0) {
      console.log('\nCATATAN YANG PERLU DIKONFIRMASI (aturan saat ini sudah sesuai harapan):');
      for (const t of this.catatanKonfirmasi) console.log(`  - ${t}`);
    }
  }
}
