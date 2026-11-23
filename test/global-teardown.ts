import { withAdmin } from './global-setup';

export default async function globalTeardown() {
  const name = new URL(process.env.E2E_DATABASE_URL!).pathname.slice(1);
  // Hanya database yang dibuat run ini.
  if (/^starter_e2e_\d+$/.test(name)) {
    await withAdmin(`DROP DATABASE \`${name}\``);
  }
}
