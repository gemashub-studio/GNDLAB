import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Muat apps/web/.env ke process.env (tanpa menimpa variabel yang sudah ada). */
export function loadEnv() {
  const path = fileURLToPath(new URL('../.env', import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/.exec(line.trim());
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
  }
}
