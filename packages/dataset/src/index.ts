import rawDataset from './generated/dataset.json';
import rawProcessDataset from './generated/process-dataset.json';
import rawFormulaDataset from './generated/formula-dataset.json';
import rawChainDataset from './generated/chain-dataset.json';
import provenance from './generated/provenance.json';
import { loadDataset, type DatasetSI } from './loader.ts';
import { loadProcessDataset, type ProcessDatasetSI } from './process.ts';
import { loadFormulaDataset, type FormulaDatasetSI } from './formula.ts';
import { loadChainDataset, type ChainDatasetSI } from './chain.ts';

export * from './loader.ts';
export * from './scenario.ts';
export * from './schema.ts';
export * from './process.ts';
export * from './overrides.ts';
export * from './formula.ts';
export * from './chain.ts';
export { rawDataset, rawProcessDataset, rawFormulaDataset, rawChainDataset, provenance };

let cached: DatasetSI | undefined;
let cachedProcess: ProcessDatasetSI | undefined;
let cachedFormula: FormulaDatasetSI | undefined;
let cachedChain: ChainDatasetSI | undefined;

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

/** Dataset formula ter-bundle (ADR-009), divalidasi & dicek kompatibilitas dengan dataset proses. */
export function bundledFormulaDataset(): FormulaDatasetSI {
  cachedFormula ??= loadFormulaDataset(rawFormulaDataset, bundledProcessDataset());
  return cachedFormula;
}

/** Dataset rantai produksi ter-bundle (ADR-010), dicek kompatibilitas dengan dataset formula & inventory. */
export function bundledChainDataset(): ChainDatasetSI {
  cachedChain ??= loadChainDataset(rawChainDataset, bundledFormulaDataset(), bundledDataset());
  return cachedChain;
}
