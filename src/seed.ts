import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Akun demo fiktif, didokumentasikan di README. Idempoten.
export const DEMO_USERS = [
  { email: 'admin@demo.test', name: 'Admin Demo', password: 'Admin123!demo', role: Role.ADMIN },
  { email: 'user@demo.test', name: 'User Demo', password: 'User123!demo', role: Role.USER },
];

export async function seed(prisma: PrismaClient) {
  for (const { password, ...u } of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: await bcrypt.hash(password, 10) },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => console.log('Seed selesai'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
