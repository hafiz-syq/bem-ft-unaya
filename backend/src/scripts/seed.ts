import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { parsingPdfMahasiswa } from '../services/student-import.service';
import { simpanMahasiswa } from '../controllers/student-import.save';

/**
 * Seed awal proyek: membaca backend/data/TEKNIK.pdf lalu membuat akun mahasiswa,
 * kemudian menyiapkan organisasi dan slot jabatannya.
 *
 * Pembacaan PDF dan penulisan akun memakai service yang SAMA dengan fitur unggah
 * di halaman Data Mahasiswa (services/student-import.service.ts), sehingga pola
 * baris dan aturan password tidak pernah berbeda antara keduanya.
 *
 * Bedanya hanya sikap terhadap baris bermasalah: seed berhenti total (dijalankan
 * sekali di awal proyek), sedangkan unggahan lewat halaman admin melewatinya dan
 * melaporkannya.
 */

async function main() {
  console.log('--- STARTING SEED PROCESS ---');
  const pdfPath = path.join(__dirname, '../../data/TEKNIK.pdf');

  if (!fs.existsSync(pdfPath)) {
    throw new Error('TEKNIK.pdf tidak ditemukan di folder backend/data/');
  }

  // TAHAP A: Parsing & Validasi
  const hasil = await parsingPdfMahasiswa(fs.readFileSync(pdfPath));

  console.log(`\nPDF RESULT`);
  console.log(`Total Parsed       : ${hasil.totalDibaca}`);
  console.log(`Valid              : ${hasil.valid.length}`);
  console.log(`Bermasalah         : ${hasil.bermasalah.length}\n`);

  if (hasil.bermasalah.length > 0) {
    for (const b of hasil.bermasalah.slice(0, 10)) {
      console.log(`  - ${b.nim || '(NIM kosong)'} ${b.nama}: ${b.alasan}`);
    }
    if (hasil.bermasalah.length > 10) {
      console.log(`  ... dan ${hasil.bermasalah.length - 10} baris lain.`);
    }
    throw new Error('VALIDASI GAGAL: Ditemukan baris bermasalah. Seed dibatalkan.');
  }

  if (hasil.valid.length === 0) {
    throw new Error('VALIDASI GAGAL: Tidak ada baris mahasiswa yang terbaca dari PDF.');
  }

  // TAHAP B & C: penyiapan password lalu penyisipan berkelompok.
  // Idempoten: NIM yang sudah ada dilewati, bukan ditimpa.
  console.log('Seeding students to database...');
  const simpan = await simpanMahasiswa(hasil.valid);

  console.log(`\nInserted           : ${simpan.dibuat}`);
  console.log(`Existing/skipped   : ${simpan.dilewati.length}`);
  if (simpan.gagal.length > 0) {
    console.log(`Gagal disimpan     : ${simpan.gagal.length} (${simpan.gagal.slice(0, 10).join(', ')})`);
  }

  // SEED ORGANISASI (Transaksi Singkat Tersendiri)
  console.log('\nSeeding Organizations & PositionSlots...');
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const orgs = [
      { name: 'BEM-FT UNAYA', slots: ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'] },
      { name: 'Himpunan Teknik Sipil', slots: ['Ketua', 'Wakil Ketua'] },
      { name: 'Himpunan Teknik Mesin', slots: ['Ketua'] },
      { name: 'Himpunan Sistem Informasi', slots: ['Ketua', 'Wakil Ketua'] },
    ];

    for (const org of orgs) {
      let dbOrg = await tx.organization.findFirst({ where: { name: org.name } });
      if (!dbOrg) {
        dbOrg = await tx.organization.create({ data: { name: org.name } });
      }

      for (const title of org.slots) {
        const existingSlot = await tx.positionSlot.findFirst({
          where: { organizationId: dbOrg.id, departmentId: null, title }
        });
        if (!existingSlot) {
          await tx.positionSlot.create({ data: { organizationId: dbOrg.id, title } });
        }
      }
    }
  });

  // TAHAP D: Verifikasi Jumlah Database Aktual
  const totalMahasiswa = await prisma.user.count({ where: { role: 'MAHASISWA' } });
  const totalProfiles = await prisma.studentProfile.count();
  const totalOrgs = await prisma.organization.count();
  const totalSlots = await prisma.positionSlot.count();

  console.log('\n--- SEED COMPLETED ---');
  console.log(`PDF Students       : ${hasil.valid.length}`);
  console.log(`New Students       : ${simpan.dibuat}`);
  console.log(`Existing Students  : ${simpan.dilewati.length}`);
  console.log(`Bermasalah         : ${hasil.bermasalah.length}`);
  console.log(`Organizations      : ${totalOrgs}`);
  console.log(`Position Slots     : ${totalSlots}`);

  if (totalMahasiswa !== totalProfiles) {
    console.warn('\nWARNING: Jumlah User Mahasiswa tidak sama dengan jumlah StudentProfile!');
  }
}

main()
  .catch(e => {
    console.error('\nERROR:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
