import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

export const ADMIN_URL =
  process.env.E2E_ADMIN_URL ?? 'mysql://root:root@localhost:3306/mysql';

export async function withAdmin(sql: string) {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe(sql);
  } finally {
    await admin.$disconnect();
  }
}

// Tiap run e2e memakai database baru yang kosong: dibuat, dimigrasi, di-seed, lalu dihapus di teardown.
// Tidak ada database lama yang direset.
export default async function globalSetup() {
  const name = `starter_e2e_${Date.now()}`;
  await withAdmin(`CREATE DATABASE \`${name}\``);

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  process.env.E2E_DATABASE_URL = url.toString();

  const env = { ...process.env, DATABASE_URL: url.toString() };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx ts-node src/seed.ts', { stdio: 'inherit', env });
}
