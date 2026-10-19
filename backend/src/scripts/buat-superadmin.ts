import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import readline from 'readline';

/**
 * Membuat akun SUPERADMIN (pengelola web).
 *
 * Akun ini satu tingkat di atas ADMIN: hanya SUPERADMIN yang boleh mengubah
 * role akun ADMIN, dan akun SUPERADMIN tidak pernah bisa dinonaktifkan. Dengan
 * begitu sistem tidak bisa terkunci karena seluruh admin diturunkan.
 *
 * Pemakaian:
 *   npm run superadmin
 *   npm run superadmin -- <nim> <password> [email]
 *
 * Password minimal 8 karakter. Email opsional tetapi sangat disarankan supaya
 * fitur lupa password berlaku untuk akun ini.
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const tanya = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n=== BUAT AKUN SUPERADMIN ===');

  const nimArg = process.argv[2];
  const passwordArg = process.argv[3];
  const emailArg = process.argv[4];

  const nim = (nimArg ?? (await tanya('Username/NIM Superadmin: '))).trim();
  const password = passwordArg ?? (await tanya('Password (min 8 karakter): '));
  const email = (emailArg ?? (await tanya('Email akun (opsional, untuk lupa password): '))).trim().toLowerCase();

  if (!nim) throw new Error('Username/NIM wajib diisi.');
  if (!password || password.length < 8) throw new Error('Password minimal 8 karakter.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Format email tidak valid.');

  const sudahAda = await prisma.user.findUnique({ where: { nim } });
  if (sudahAda) {
    throw new Error(`Akun dengan NIM/username ${nim} sudah ada (role: ${sudahAda.role}).`);
  }

  if (email) {
    const emailDipakai = await prisma.user.findFirst({ where: { email }, select: { nim: true } });
    if (emailDipakai) throw new Error(`Email ${email} sudah dipakai akun ${emailDipakai.nim}.`);
  }

  const password_hash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      nim,
      password_hash,
      role: 'SUPERADMIN',
      first_login: false,
      isActive: true,
      email: email || null,
    },
  });

  console.log(`\nBERHASIL: Superadmin [${nim}] dibuat.`);
  console.log('Akun ini tidak dapat dinonaktifkan dan hanya bisa diubah oleh superadmin lain.\n');
}

main()
  .catch((e) => {
    console.error('\nERROR:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
