// Salin dataset sumber kebenaran ke src/generated/ saat build. JANGAN edit salinan secara manual —
// ubah architecture/00-research/data/coconut_inventory_dataset.json lalu jalankan ulang (CLAUDE.md).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../../architecture/00-research/data/coconut_inventory_dataset.json', import.meta.url));
const outDir = fileURLToPath(new URL('../src/generated/', import.meta.url));

const raw = readFileSync(src);
const sha256 = createHash('sha256').update(raw).digest('hex');
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}dataset.json`, raw);
writeFileSync(
  `${outDir}provenance.json`,
  JSON.stringify({ source: 'architecture/00-research/data/coconut_inventory_dataset.json', sha256 }, null, 2) + '\n',
);
console.log(`dataset disalin (sha256 ${sha256.slice(0, 12)}…)`);
