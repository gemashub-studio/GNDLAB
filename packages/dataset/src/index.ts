import rawDataset from './generated/dataset.json';
import provenance from './generated/provenance.json';
import { loadDataset, type DatasetSI } from './loader.ts';

export * from './loader.ts';
export * from './schema.ts';
export { rawDataset, provenance };

let cached: DatasetSI | undefined;

/** Dataset versi terkunci yang ter-bundle (divalidasi Zod saat pertama dimuat). */
export function bundledDataset(): DatasetSI {
  cached ??= loadDataset(rawDataset);
  return cached;
}
