/**
 * Global setup E2E kalibrasi: siapkan DB test (db-setup.ts), lalu setelah selesai kembalikan file yang
 * ditulis ulang `next dev` untuk folder build `.next-calib` (next-env.d.ts & include tsconfig).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dbSetup from './db-setup';

const file = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

function restore() {
  const envDts = file('next-env.d.ts');
  writeFileSync(envDts, readFileSync(envDts, 'utf8').replace('./.next-calib/types/', './.next/types/'));
  const tsPath = file('tsconfig.json');
  const ts = JSON.parse(readFileSync(tsPath, 'utf8')) as { include: string[] };
  ts.include = ts.include.filter((p) => !p.startsWith('.next-calib/'));
  writeFileSync(tsPath, `${JSON.stringify(ts, null, 2)}\n`);
}

export default async function setup() {
  await dbSetup();
  return restore;
}
