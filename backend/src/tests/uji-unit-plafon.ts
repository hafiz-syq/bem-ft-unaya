/**
 * Unit test plafon AUDIT-13 — tanpa server & tanpa database.
 *
 *   K. Plafon dimensi inside 3200 pada jalur konversi WebP (H1): bahan 60 MP,
 *      kontrol byte-identik untuk gambar <= plafon, pagar byte pasca-konversi,
 *      dan K(d) mengunci EXIF orientation 6 + sisi di atas plafon = potret (J1).
 *   L. Batas 2.000 halaman PDF impor mahasiswa (H2): penolakan terjadi SEBELUM
 *      loop halaman, data di bawah batas tetap terekstrak sama, dan kalimat
 *      barunya sampai ke klien lewat pratinjauImpor sebagai 400.
 *
 * Dijalankan oleh: npm run test:unit (rantai dengan uji-unit-kritis.ts)
 */

import './penahan-host-uji';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { konversiGambarKeWebp, UPLOAD_LIMITS } from '../middlewares/upload.middleware';
import { BATAS_HALAMAN_PDF, parsingPdfMahasiswa } from '../services/student-import.service';
import { pratinjauImpor } from '../controllers/student-import.controller';

let lulus = 0;
const gagal: string[] = [];

function uji(nama: string, kondisi: boolean): void {
  if (kondisi) {
    lulus++;
    console.log(`  LULUS   ${nama}`);
  } else {
    gagal.push(nama);
    console.log(`  GAGAL   ${nama}`);
  }
}

async function main(): Promise<void> {
  console.log('\n=== K. Plafon dimensi inside 3200 pada jalur konversi (AUDIT-13 H1) ===\n');

  {
    // Rantai persis sebelum patch ini (tanpa langkah resize), jadi pembanding
    // byte-ke-byte untuk kontrol "gambar <= plafon tidak boleh disentuh".
    const tanpaPlafon = (buf: Buffer) =>
      sharp(buf, { failOn: 'none', limitInputPixels: 60_000_000 }).rotate().webp({ quality: 82, effort: 4 }).toBuffer();

    const unggah = async (buf: Buffer, nama: string) => {
      const berkas = { buffer: buf, mimetype: 'image/png', originalname: nama, fieldname: 'file', size: buf.length };
      const galat: any = await new Promise((selesai) =>
        konversiGambarKeWebp({ files: { file: [berkas] } } as any, {} as any, selesai as any, UPLOAD_LIMITS.file)
      );
      return { berkas, galat };
    };

    // Period-2 piksel pada KEDUA sumbu; bahan 1-D (garis vertikal saja) hanya
    // menghasilkan 499 KB dan tidak membuktikan apa-apa (kesalahan AUDIT-12).
    const papanCatur = async (lebar: number, tinggi: number) => {
      const warna = (putihDulu: boolean) => {
        const b = Buffer.alloc(lebar * 3);
        for (let x = 0; x < lebar; x++) b[x * 3] = b[x * 3 + 1] = b[x * 3 + 2] = (x % 4 < 2) === putihDulu ? 255 : 0;
        return b;
      };
      const barisA = warna(true);
      const barisB = warna(false);
      const raw = Buffer.alloc(lebar * tinggi * 3);
      for (let y = 0; y < tinggi; y++) (y % 4 < 2 ? barisA : barisB).copy(raw, y * lebar * 3);
      return sharp(raw, { raw: { width: lebar, height: tinggi, channels: 3 } }).png().toBuffer();
    };

    const gradasi = async (lebar: number, tinggi: number) => {
      const raw = Buffer.alloc(lebar * tinggi * 3);
      for (let y = 0; y < tinggi; y++)
        for (let x = 0; x < lebar; x++) {
          const i = (y * lebar + x) * 3;
          raw[i] = Math.round((x * 255) / (lebar - 1));
          raw[i + 1] = Math.round((y * 255) / (tinggi - 1));
          raw[i + 2] = Math.round(((x + y) * 255) / (lebar + tinggi - 2));
        }
      return sharp(raw, { raw: { width: lebar, height: tinggi, channels: 3 } }).png().toBuffer();
    };

    const bahan60Mp = await papanCatur(8000, 7500); // PNG ~898 KB, WebP tanpa plafon 13,29 MB
    const besar = await unggah(bahan60Mp, 'uji-k-a.png');
    const metaBesar = await sharp(besar.berkas.buffer).metadata();
    uji(
      `K(a): papan-catur 60 MP (masuk ${bahan60Mp.length} B) keluar sebagai WebP bersisi 3200 dan < 5 MB`,
      besar.galat === undefined &&
        metaBesar.format === 'webp' &&
        Math.max(metaBesar.width ?? 0, metaBesar.height ?? 0) === 3200 &&
        besar.berkas.size < UPLOAD_LIMITS.file
    );

    for (const [lebar, tinggi] of [
      [3200, 2400],
      [1600, 1200],
    ]) {
      const asli = await gradasi(lebar, tinggi);
      const sesudah = (await unggah(asli, `uji-k-b-${lebar}.png`)).berkas.buffer;
      uji(
        `K(b): ${lebar}x${tinggi} (sisi terpanjang <= 3200) keluarannya byte-identik dengan jalur pra-plafon`,
        sesudah.equals(await tanpaPlafon(asli))
      );
    }

    const kamera = await gradasi(4032, 3024);
    const hasilKamera = await unggah(kamera, 'uji-k-b2.png');
    const metaKamera = await sharp(hasilKamera.berkas.buffer).metadata();
    uji(
      'K(b2): 4032x3024 (di ATAS plafon) memang diturunkan ke 3200, jadi kontrol "identik di 4032" tidak mungkin dipenuhi',
      Math.max(metaKamera.width ?? 0, metaKamera.height ?? 0) === 3200 &&
        hasilKamera.berkas.size < (await tanpaPlafon(kamera)).length
    );

    const bisingRaw = Buffer.alloc(3200 * 2400 * 3);
    let benih = 7;
    for (let i = 0; i < bisingRaw.length; i++) {
      benih = (benih * 1664525 + 1013904223) >>> 0;
      bisingRaw[i] = Math.floor((benih / 4294967296) * 256);
    }
    const bising = await sharp(bisingRaw, { raw: { width: 3200, height: 2400, channels: 3 } }).png().toBuffer();
    const hasilBising = await unggah(bising, 'uji-k-c.png');
    uji(
      'K(c): artefak > 5 MB pada dimensi <= plafon tetap ditolak dengan LIMIT_FILE_SIZE (pagar D1 masih bekerja)',
      hasilBising.galat?.code === 'LIMIT_FILE_SIZE' && (await tanpaPlafon(bising)).length > UPLOAD_LIMITS.file
    );

    // K(d) — AUDIT-15 J1. Kamera HP menyimpan foto potret sebagai kanvas
    // landscape + EXIF orientation 6/8, jadi sisi TERPANJANG ada di sumbu X
    // SEBELUM rotasi. Bila .rotate() hilang (atau dipindah ke belakang sebuah
    // resize yang plafonnya hanya satu sumbu), 3200 memotong sumbu yang salah
    // dan foto potret keluar sebagai landscape. Kontrol `tanpaRotasi` di bawah
    // membuktikan assertion ini membedakan kedua keadaan, bukan selalu benar.
    const mulaiKd = Date.now();
    const rawPotret = Buffer.alloc(4032 * 3024 * 3);
    for (let y = 0; y < 3024; y++)
      rawPotret.fill(40 + Math.floor((y / 3024) * 6) * 30, y * 4032 * 3, (y + 1) * 4032 * 3);
    const bahanPotret = await sharp(rawPotret, { raw: { width: 4032, height: 3024, channels: 3 } })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const hasilPotret = await unggah(bahanPotret, 'uji-k-d.jpg');
    const metaPotret = await sharp(hasilPotret.berkas.buffer).metadata();
    const metaBahan = await sharp(bahanPotret).metadata();
    const tanpaRotasi = await sharp(bahanPotret, { failOn: 'none' })
      .resize({ width: 3200, height: 3200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    const metaTanpaRotasi = await sharp(tanpaRotasi).metadata();
    const msKd = Date.now() - mulaiKd;
    uji(
      `K(d): EXIF orientation=${metaBahan.orientation} + 4032 di ATAS plafon -> POTRET ${metaPotret.width}x${metaPotret.height} ` +
        `(sisi terpanjang vertikal 3200), orientasi tidak terbawa, bahan ${(bahanPotret.length / 1024).toFixed(1)} KB -> ` +
        `${(hasilPotret.berkas.size / 1024).toFixed(1)} KB dalam ${msKd} ms [kontrol tanpa .rotate(): ` +
        `${metaTanpaRotasi.width}x${metaTanpaRotasi.height}]`,
      hasilPotret.galat === undefined &&
        metaBahan.orientation === 6 &&
        metaPotret.orientation === undefined &&
        metaPotret.height === 3200 &&
        metaPotret.width === 2400 &&
        // kontrol yang sama tanpa .rotate() WAJIB landscape: tanpa baris ini
        // test-nya buta terhadap urutan rantai.
        metaTanpaRotasi.width === 3200 &&
        metaTanpaRotasi.height === 2400 &&
        bahanPotret.length < 200_000 &&
        msKd < 5000
    );
  }

  console.log('\n=== L. Batas 2.000 halaman PDF impor mahasiswa (AUDIT-13 H2) ===\n');

  {
    // PDF sah buatan sendiri: N halaman, `baris` pertama berisi data lengkap.
    // Berkas nyata (backend/data/TEKNIK.pdf) tidak bisa dipakai: di-gitignore.
    // `rusak` = halaman ke-2 dan seterusnya menunjuk /Contents 99999 0 R yang
    // tidak ada di file; pdfjs menoleransinya (halaman kosong), jadi kontrol ini
    // memisahkan "dibaca dari header /Count" dari "dibaca dari isi halaman".
    const pdfHalaman = (jumlah: number, baris: number, rusak = false): Buffer => {
      const teks = (i: number) =>
        i < baris
          ? `MAHASISWA ${String.fromCharCode(65 + i)} | 2101${String(i + 1).padStart(4, '0')} | TEKNIK MESIN`
          : `Halaman ${i + 1}`;
      const isi = (i: number) => `BT /F1 10 Tf 40 800 Td (${teks(i)}\\n) Tj ET\n`;
      const obj: string[] = [];
      const anak: string[] = [];
      for (let i = 0; i < jumlah; i++) anak.push(`${3 + i} 0 R`);
      const aliran = 3 + jumlah;
      obj[1] = '1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n';
      obj[2] = `2 0 obj\n<</Type/Pages/Kids[${anak.join(' ')}]/Count ${jumlah}>>\nendobj\n`;
      for (let i = 0; i < jumlah; i++) {
        const hal = 3 + i;
        const isian = isi(i);
        obj[hal] = `${hal} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents ${
          rusak && i > 0 ? 99999 : aliran + i
        } 0 R/Resources<</Font<</F1 ${aliran + jumlah} 0 R>>>>>>\nendobj\n`;
        obj[aliran + i] = `${aliran + i} 0 obj\n<</Length ${isian.length}>>\nstream\n${isian}endstream\nendobj\n`;
      }
      obj[aliran + jumlah] = `${aliran + jumlah} 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n`;
      const total = aliran + jumlah + 1;
      let pdf = '%PDF-1.4\n';
      const ofs: number[] = [];
      for (let i = 1; i < total; i++) {
        ofs[i] = pdf.length; // semua byte ASCII, jadi length == byteLength
        pdf += obj[i];
      }
      const xref = pdf.length;
      pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
      for (let i = 1; i < total; i++) pdf += String(ofs[i]).padStart(10, '0') + ' 00000 n \n';
      return Buffer.from(`${pdf}trailer\n<</Size ${total}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`, 'binary');
    };

    const coba = async (buf: Buffer) => {
      const mulai = Date.now();
      try {
        return { ms: Date.now() - mulai, hasil: await parsingPdfMahasiswa(buf) };
      } catch (galat) {
        return { ms: Date.now() - mulai, galat: galat as Error };
      }
    };

    const pdfAmbang = pdfHalaman(BATAS_HALAMAN_PDF + 1, 20);
    const pdfTepat = pdfHalaman(BATAS_HALAMAN_PDF, 20);
    const pdfTipis = pdfHalaman(20, 20);
    const tipis = await coba(pdfTipis);
    const tepat = await coba(pdfTepat);
    const lewat = await coba(pdfAmbang);
    const kalimat = (lewat.galat as Error | undefined)?.message ?? '';

    uji('L0: batas yang dikunci adalah 2.000 halaman', BATAS_HALAMAN_PDF === 2000);
    uji(
      `L(a): PDF ${BATAS_HALAMAN_PDF + 1} halaman ditolak, dan penolakannya ${lewat.ms} ms untuk dokumen ~${(pdfAmbang.length / 1024).toFixed(0)} KB (bayar satu properti header, bukan ${BATAS_HALAMAN_PDF} halaman)`,
      lewat.galat !== undefined &&
        (lewat.galat as { kalimatAdmin?: boolean }).kalimatAdmin === true &&
        kalimat.includes(String(BATAS_HALAMAN_PDF + 1)) &&
        lewat.ms < 150
    );
    uji(
      `L(b): PDF <= ${BATAS_HALAMAN_PDF} halaman tetap lolos dan 20 barisnya terekstrak identik dengan dokumen kecil`,
      tepat.hasil !== undefined &&
        !tepat.galat &&
        JSON.stringify(tepat.hasil?.valid) === JSON.stringify(tipis.hasil?.valid) &&
        tipis.hasil?.valid.length === 20 &&
        tipis.hasil?.valid[0]?.nim === '21010001'
    );
    // Bukti penolakannya BUKAN hasil membaca halaman: dokumen 2.001 halaman
    // yang stream-nya rusak tetap kena kalimat batas (bukan galat pdfjs), dan
    // kerusakan yang sama pada 3 halaman tidak menghalangi baris data terbaca.
    const rusakAtas = await coba(pdfHalaman(BATAS_HALAMAN_PDF + 1, 1, true));
    const rusakBawah = await coba(pdfHalaman(3, 1, true));
    uji(
      'L(c): penolakan dibaca dari header /Count, bukan dari isi halaman (2.001 halaman rusak kena kalimat batas; 3 halaman rusak sama tetap terbaca)',
      rusakAtas.galat?.message === kalimat && rusakBawah.hasil?.valid.length === 1 && !rusakBawah.galat
    );

    const sumber = readFileSync(resolve(__dirname, '../services/student-import.service.ts'), 'utf8');
    const idxPagar = sumber.indexOf('dokumen.numPages > BATAS_HALAMAN_PDF');
    const idxLoop = sumber.indexOf('for (let nomor = 1; nomor <= dokumen.numPages; nomor++)');
    uji(
      'L(d): pagar berdiri di depan loop 1..numPages di bacaIsiPdf, satu titik yang dipakai jalur pratinjau MAUPUN simpan',
      idxPagar > 0 && idxLoop > idxPagar && sumber.includes('export async function parsingPdfMahasiswa')
    );

    const jawab: any = {};
    const tiruanRes = {
      status: () => tiruanRes,
      json: (isi: any) => ((jawab.isi = isi), tiruanRes),
    };
    await pratinjauImpor(
      { file: { buffer: pdfAmbang, mimetype: 'application/pdf', originalname: 'uji-l.pdf' } } as any,
      tiruanRes as any,
      (e: any) => ((jawab.next = e), undefined)
    );
    uji(
      'L(e): kalimat batas halaman sampai ke klien sebagai 400, bukan digantikan pesan PDF umum',
      jawab.isi?.message === kalimat && jawab.next === undefined
    );
  }
  console.log(`\n--- RINGKASAN UNIT TEST PLAFON ---\nLulus: ${lulus}\nGagal: ${gagal.length}\n`);
  if (gagal.length > 0) {
    console.log('GAGAL:');
    gagal.forEach((g) => console.log(`  - ${g}`));
    process.exit(1);
  }
  console.log('HASIL: SEMUA UNIT TEST PLAFON LULUS');
}

main().catch((error) => {
  console.error('Unit test plafon gagal dijalankan:', error);
  process.exit(1);
});
