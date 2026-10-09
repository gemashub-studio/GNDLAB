import rawDataset from './generated/dataset.json';
import rawProcessDataset from './generated/process-dataset.json';
import provenance from './generated/provenance.json';
import { loadDataset, type DatasetSI } from './loader.ts';
import { loadProcessDataset, type ProcessDatasetSI } from './process.ts';

export * from './loader.ts';
export * from './scenario.ts';
export * from './schema.ts';
export * from './process.ts';
export * from './overrides.ts';
export { rawDataset, rawProcessDataset, provenance };

let cached: DatasetSI | undefined;
let cachedProcess: ProcessDatasetSI | undefined;

/** Dataset versi terkunci yang ter-bundle (divalidasi Zod saat pertama dimuat). */
export function bundledDataset(): DatasetSI {
  cached ??= loadDataset(rawDataset);
  return cached;
}

/** Dataset proses ter-bundle (ADR-007), divalidasi & dicek kompatibilitas versinya. */
export function bundledProcessDataset(): ProcessDatasetSI {
  cachedProcess ??= loadProcessDataset(rawProcessDataset, bundledDataset());
  return cachedProcess;
}
