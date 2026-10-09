import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Muat apps/web/.env ke process.env (tanpa menimpa variabel yang sudah ada).
 * Test integrasi SELALU memakai database test terpisah (TEST_DATABASE_URL, di-reset oleh
 * test/db-setup.ts) agar database dev & versi dataset aktif tidak tersentuh.
 */
export function loadEnv() {
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/.exec(line.trim());
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
    }
  }
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  else delete process.env.DATABASE_URL; // tanpa DB test → test DB dilewati, DB dev aman
}
