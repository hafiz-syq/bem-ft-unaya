import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('\n=== ADMIN BOOTSTRAP ===');
  
  const rawNim = await question('Username/NIM Admin: ');
  const nim = rawNim.trim();
  
  const password = await question('Password (min 8 char): ');

  if (!nim || password.length < 8) {
    throw new Error('Validasi gagal: Username kosong atau password kurang dari 8 karakter.');
  }

  const existing = await prisma.user.findUnique({ where: { nim } });
  if (existing) {
    throw new Error(`User dengan NIM/Username ${nim} sudah ada.`);
  }

  const password_hash = await bcrypt.hash(password, 10);
  
  await prisma.user.create({
    data: {
      nim,
      password_hash,
      role: 'ADMIN',
      first_login: false
      // TANPA StudentProfile
    }
  });

  console.log(`\nBERHASIL: Admin [${nim}] telah dibuat.\n`);
}

main()
  .catch(e => {
    console.error('\nERROR:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });