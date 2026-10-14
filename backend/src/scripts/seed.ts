import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

const pdfParse = require('pdf-parse');

async function extractAndValidate(filePath: string) {
  const dataBuffer = fs.readFileSync(filePath);
  const parse = pdfParse.default || pdfParse;
  const data = await parse(dataBuffer);
  const text = data.text;
  
  const students: { nama: string; nim: string; program_studi: string }[] = [];
  let invalidCount = 0;
  
  const nimSet = new Set<string>();
  let duplicateNIM = 0;

  const regex = /(?:([A-Za-z\.\,\'\ -]+?)\s*\|?\s*(\d{8}[A-Za-z]?)|(\d{8}[A-Za-z]?)\s*\|?\s*([A-Za-z\.\,\'\ -]+?))\s*\|?\s*(SISTEM INFORMASI|TEKNIK MESIN|TEKNIK SIPIL)/gi;
  const matches = [...text.matchAll(regex)];

  for (const match of matches) {
    const rawNama = match[1] || match[4];
    const rawNim = match[2] || match[3];

    const nama = rawNama.replace(/\n/g, ' ').trim();
    const nim = rawNim.trim().toUpperCase();
    const prodi = match[5].trim().toUpperCase();

    if (nama.toLowerCase().includes('nama mahasiswa')) continue;

    if (!nama || !nim || !prodi) {
      invalidCount++;
      continue;
    }

    if (nimSet.has(nim)) {
      duplicateNIM++;
      continue;
    }
    
    nimSet.add(nim);
    students.push({ nama, nim, program_studi: prodi });
  }

  return { students, totalParsed: matches.length, invalidCount, duplicateNIM };
}

async function main() {
  console.log('--- STARTING SEED PROCESS ---');
  const pdfPath = path.join(__dirname, '../../data/TEKNIK.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    throw new Error('TEKNIK.pdf tidak ditemukan di folder backend/data/');
  }

  // TAHAP A: Parsing & Validasi
  const { students, totalParsed, invalidCount, duplicateNIM } = await extractAndValidate(pdfPath);
  
  console.log(`\nPDF RESULT`);
  console.log(`Total Parsed       : ${totalParsed}`);
  console.log(`Valid              : ${students.length}`);
  console.log(`Invalid            : ${invalidCount}`);
  console.log(`Duplicate NIM      : ${duplicateNIM}\n`);

  if (invalidCount > 0 || duplicateNIM > 0 || students.length === 0) {
    throw new Error('VALIDASI GAGAL: Ditemukan invalid data atau duplikasi. Seed dibatalkan.');
  }

  // TAHAP B: Pengecekan Idempotency & Persiapan Hashing di Luar Transaksi
  console.log('Checking existing students in database...');
  const allParsedNims = students.map((s) => s.nim);
  
  const existingUsers = await prisma.user.findMany({
    where: { nim: { in: allParsedNims } },
    select: { nim: true }
  });
  
  // PERBAIKAN TS7006: Menambahkan tipe eksplisit pada parameter 'u'
  const existingNimSet = new Set(existingUsers.map((u: { nim: string }) => u.nim));

  const newStudents = students.filter((s) => !existingNimSet.has(s.nim));
  const existingStudentsCount = students.length - newStudents.length;

  const preparedStudents = [];
  if (newStudents.length > 0) {
    console.log(`\nPreparing passwords for ${newStudents.length} new students...`);
    for (let i = 0; i < newStudents.length; i++) {
      const student = newStudents[i];
      const password_hash = await bcrypt.hash(student.nim, 10);
      preparedStudents.push({ ...student, password_hash });

      if ((i + 1) % 50 === 0 || i + 1 === newStudents.length) {
        console.log(`Prepared ${i + 1}/${newStudents.length}`);
      }
    }
  } else {
    console.log('\nNo new students to prepare. All exist in database.');
  }

  // TAHAP C: Database Transaction (Batching)
  if (preparedStudents.length > 0) {
    console.log(`\nSeeding students to database in batches...`);
    const CHUNK_SIZE = 50;
    let insertedCount = 0;

    for (let i = 0; i < preparedStudents.length; i += CHUNK_SIZE) {
      const chunk = preparedStudents.slice(i, i + CHUNK_SIZE);
      
      // Transaksi dibuat sangat singkat hanya untuk operasi insert DB
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const student of chunk) {
          await tx.user.create({
            data: {
              nim: student.nim,
              password_hash: student.password_hash,
              role: 'MAHASISWA',
              first_login: true,
              profile: {
                create: { 
                  nama: student.nama, 
                  nim: student.nim, 
                  program_studi: student.program_studi 
                }
              }
            }
          });
        }
      });
      
      insertedCount += chunk.length;
      console.log(`Inserted ${insertedCount}/${preparedStudents.length}`);
    }
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
  console.log(`PDF Students       : ${students.length}`);
  console.log(`New Students       : ${preparedStudents.length}`);
  console.log(`Existing Students  : ${existingStudentsCount}`);
  console.log(`Invalid            : ${invalidCount}`);
  console.log(`Duplicate NIM      : ${duplicateNIM}`);
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