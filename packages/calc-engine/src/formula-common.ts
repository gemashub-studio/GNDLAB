/**
 * Dasar bersama engine formula R&D & produksi (ADR-009). Fungsi murni, rentang {min,typ,max}
 * via evaluasi sudut (ADR-003), setiap hasil membawa keyakinan, peringatan, dan jejak.
 */
import type { Confidence, Param, Range } from './range.ts';
import { buildTrace, combinedConfidence, dedupeWarnings, type Trace } from './trace.ts';
import { lowConfidenceWarnings, type CalcWarning } from './warnings.ts';

export interface FormulaOutput<T extends Record<string, number>> {
  result: { min: T; typ: T; max: T };
  /** Keyakinan gabungan = terlemah dari parameter yang dipakai (DEC-008). */
  confidence: Confidence;
  warnings: CalcWarning[];
  trace: Trace;
}

export function formulaOutput<T extends Record<string, number>>(
  result: { min: T; typ: T; max: T },
  params: readonly Param[],
  warnings: readonly CalcWarning[],
  datasetVersion?: string,
): FormulaOutput<T> {
  return {
    result,
    confidence: params.length ? combinedConfidence(params) : 'A',
    warnings: dedupeWarnings([...warnings, ...lowConfidenceWarnings(params)]),
    trace: buildTrace(params, datasetVersion),
  };
}

export function assertPositive(v: number, label: string): void {
  if (!(Number.isFinite(v) && v > 0)) throw new RangeError(`${label} harus > 0, didapat ${v}`);
}

export function assertNonNegative(v: number, label: string): void {
  if (!(Number.isFinite(v) && v >= 0)) throw new RangeError(`${label} harus ≥ 0, didapat ${v}`);
}

export function assertPct(v: number, label: string, maxExclusive = 100): void {
  if (!(Number.isFinite(v) && v >= 0 && v < maxExclusive)) {
    throw new RangeError(`${label} harus 0–${maxExclusive} %, didapat ${v}`);
  }
}

/** Gabungkan dua rentang yang dievaluasi terpisah tetapi monoton searah (mis. jumlah). */
export const rangeOf = (r: { min: number; typ: number; max: number }): Range => ({ min: r.min, typ: r.typ, max: r.max });
