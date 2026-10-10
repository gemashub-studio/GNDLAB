// Salin dataset sumber kebenaran ke src/generated/ saat build. JANGAN edit salinan secara manual —
// ubah file di architecture/00-research/data/ lalu jalankan ulang (CLAUDE.md).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = {
  'dataset.json': 'coconut_inventory_dataset.json',
  'process-dataset.json': 'coconut_process_dataset.json',
  'formula-dataset.json': 'coconut_formula_dataset.json',
  'chain-dataset.json': 'coconut_chain_dataset.json',
};
const srcDir = fileURLToPath(new URL('../../../architecture/00-research/data/', import.meta.url));
const outDir = fileURLToPath(new URL('../src/generated/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const provenance = {};
for (const [out, src] of Object.entries(FILES)) {
  const raw = readFileSync(`${srcDir}${src}`);
  const sha256 = createHash('sha256').update(raw).digest('hex');
  writeFileSync(`${outDir}${out}`, raw);
  provenance[out] = { source: `architecture/00-research/data/${src}`, sha256 };
  console.log(`${src} disalin (sha256 ${sha256.slice(0, 12)}…)`);
}
// Kompatibilitas: bidang `sha256` level atas = dataset inventory.
writeFileSync(
  `${outDir}provenance.json`,
  JSON.stringify({ ...provenance['dataset.json'], files: provenance }, null, 2) + '\n',
);
