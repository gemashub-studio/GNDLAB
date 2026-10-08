/**
 * Jejak kalkulasi: setiap hasil membawa parameter yang dipakai, sumbernya, dan keyakinannya
 * (calculation_spec §1.4, NFR-05). Bentuk mengikuti contoh respons ARD §6.
 */
import type { Binding } from './types.ts';
import { weakestConfidence, type Confidence, type Param, type ParamSource, type Range } from './range.ts';
import type { CalcWarning } from './warnings.ts';

export const ENGINE_VERSION = '1.0.0';

export interface TraceEntry {
  value: Range;
  source: ParamSource;
  confidence: Confidence;
  sourceIds: string[];
}

export interface Trace {
  engineVersion: string;
  datasetVersion?: string;
  params: Record<string, TraceEntry>;
}

export interface CalcOutput<T> {
  result: { min: T; typ: T; max: T };
  binding: Binding;
  /** Keyakinan gabungan = terlemah dari parameter yang dipakai (DEC-008). */
  confidence: Confidence;
  warnings: CalcWarning[];
  trace: Trace;
}

export function buildTrace(params: readonly Param[], datasetVersion?: string): Trace {
  const entries: Record<string, TraceEntry> = {};
  for (const p of params) {
    entries[p.key] = {
      value: { min: p.min, typ: p.typ, max: p.max },
      source: p.source ?? 'dataset',
      confidence: p.confidence,
      sourceIds: p.sourceIds,
    };
  }
  return datasetVersion === undefined
    ? { engineVersion: ENGINE_VERSION, params: entries }
    : { engineVersion: ENGINE_VERSION, datasetVersion, params: entries };
}

export const combinedConfidence = (params: readonly Param[]): Confidence =>
  weakestConfidence(params.map((p) => p.confidence));

/** Urutkan & buang duplikat kode peringatan (kode pertama menang). */
export function dedupeWarnings(list: readonly CalcWarning[]): CalcWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => (seen.has(w.code) ? false : (seen.add(w.code), true)));
}
