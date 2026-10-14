import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import readline from 'readline';

const prisma = new PrismaClient();

// Password TIDAK boleh ditulis di dalam kode. Kalau ditulis, nilainya ikut ter-commit
// ke git dan siapa pun yang bisa membaca repo otomatis bisa memakai akun admin.
// Pola ini disamakan dengan bootstrap-admin.ts: tanyakan saat skrip dijalankan.
const tanya = (pertanyaan: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pertanyaan, (jawaban) => {
      rl.close();
      resolve(jawaban);
    });
  });

async function main() {
  try {
    const password = (await tanya('Password baru untuk adminHafiz (min 8 karakter): ')).trim();
    if (password.length < 8) {
      throw new Error('Validasi gagal: password kurang dari 8 karakter.');
    }

    // 1. Hapus admin lama jika ada
    await prisma.user.deleteMany({
      where: { nim: '25146071' }
    });
    console.log('✅ Admin lama (25146071) berhasil dihapus (jika ada).');

    // 2. Hash password baru
    const hashedPassword = await bcrypt.hash(password, 10);

 // 3. Buat admin baru
    await prisma.user.upsert({
      where: { nim: 'adminHafiz' },
      update: { password_hash: hashedPassword },
      create: {
        nim: 'adminHafiz', 
        password_hash: hashedPassword,
        role: 'ADMIN',
        first_login: false, 
        profile: {
          create: { 
            nim: 'adminHafiz', // <--- TAMBAHKAN INI
            nama: 'Admin Hafiz', 
            program_studi: 'Sistem Informasi' 
          }
        }
      }
    });
    console.log('✅ Admin baru (adminHafiz) berhasil dibuat!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();