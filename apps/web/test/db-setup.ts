/**
 * Global setup vitest untuk database TEST (bukan dev): migrasi non-destruktif (`migrate deploy`),
 * lalu seed + terbitkan versi awal HANYA bila database masih kosong.
 * Tidak pernah me-reset/menghapus data. Untuk mengulang uji kalibrasi dari awal, owner menjalankan
 * `scripts/windows/reset-test-db.ps1` sendiri (uji kalibrasi dilewati bila DB test sudah terpakai).
 * Dilewati bila TEST_DATABASE_URL tidak ada (scripts/windows/setup-dev-db.ps1 membuatnya).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env';

export default async function setup() {
  loadEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
  const env = { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  const run = (...args: string[]) => execFileSync(process.execPath, [prismaCli, ...args], { cwd, env, stdio: 'pipe' });
  run('migrate', 'deploy');

  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    if ((await db.dataset_version.count()) > 0) return;
  } finally {
    await db.$disconnect();
  }
  run('db', 'execute', '--file', '../../architecture/03-data/seed.sql', '--schema', 'prisma/schema.prisma');
  run('db', 'execute', '--file', 'prisma/publish-seed.sql', '--schema', 'prisma/schema.prisma');
}
